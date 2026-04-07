/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  forwardRef,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DeepPartial } from 'typeorm';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { StudentProfile } from './entities/student-profile.entity';
import { StudentExamType } from './entities/student-exam-type.entity';
import { StudentExamTypeSubject } from './entities/student-exam-type-subject.entity';
import { ExamAttempt } from './entities/exam-attempt.entity';
import { QuestionProgress } from './entities/question-progress.entity';
import { FlaggedQuestion } from './entities/flagged-question.entity';
import { LoggerService } from '../logger/logger.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { ExamsService } from '../exams/exams.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { ExamAttemptStatus, FlagReasons, LogActionTypes } from '../../types';

@Injectable()
export class StudentsService {
  constructor(
    @InjectRepository(StudentProfile)
    private studentProfileRepo: Repository<StudentProfile>,
    @InjectRepository(StudentExamType)
    private studentExamTypeRepo: Repository<StudentExamType>,
    @InjectRepository(StudentExamTypeSubject)
    private studentExamTypeSubjectRepo: Repository<StudentExamTypeSubject>,
    @InjectRepository(ExamAttempt)
    private examAttemptRepo: Repository<ExamAttempt>,
    @InjectRepository(QuestionProgress)
    private questionProgressRepo: Repository<QuestionProgress>,
    @InjectRepository(FlaggedQuestion)
    private flaggedQuestionRepo: Repository<FlaggedQuestion>,
    private loggerService: LoggerService,
    private analyticsService: AnalyticsService,
    @Inject(forwardRef(() => ExamsService))
    private readonly examsService: ExamsService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  /**
   * Resolve a user ID to their student profile. Throws NotFoundException if not found.
   */
  async findStudentByUserId(userId: string): Promise<StudentProfile> {
    const student = await this.studentProfileRepo.findOne({
      where: { userId },
    });
    if (!student) throw new NotFoundException('Student profile not found');
    return student;
  }

  /**
   * Create student profile during signup/onboarding
   */
  async createStudentProfile(data: {
    userId: string;
    examTypeId?: string;
    phoneNumber?: string;
    countryCode?: string;
    // Sponsorship fields — set when student is created by/via a sponsor
    isSponsored?: boolean;
    sponsorId?: string;
    sponsorUrlId?: string;
    sponsorDisplayName?: string;
  }): Promise<StudentProfile> {
    // Normalize examTypeId (handle empty strings)
    const examTypeId = data.examTypeId?.trim() || undefined;

    const profileInput: DeepPartial<StudentProfile> = {
      userId: data.userId,
      defaultExamTypeId: examTypeId,
      lastExamTypeId: examTypeId,
      isSponsored: data.isSponsored ?? false,
      sponsorId: data.sponsorId ?? null,
      sponsorUrlId: data.sponsorUrlId ?? null,
      sponsorDisplayName: data.sponsorDisplayName ?? null,
    };
    const profile = this.studentProfileRepo.create(profileInput);
    const savedProfile = await this.studentProfileRepo.save(profile);

    // Create demo exam type record if examTypeId provided
    if (examTypeId) {
      const examType = await this.examsService.findExamTypeById(examTypeId);

      if (examType) {
        // Ensure only one demo exam type per student
        const existingDemo = await this.studentExamTypeRepo.findOne({
          where: { studentId: savedProfile.id, isDemoAllowed: true },
        });

        if (!existingDemo) {
          const studentExamType = this.studentExamTypeRepo.create({
            studentId: savedProfile.id,
            examTypeId,
            isDemoAllowed: true,
            isPaid: false,
          });
          await this.studentExamTypeRepo.save(studentExamType);
        }
      }
    }

    // Log student profile creation
    await this.loggerService.log({
      userId: data.userId,
      action: LogActionTypes.CREATE,
      description: 'Student profile created',
      metadata: {
        profileId: savedProfile.id,
        examTypeId: data.examTypeId,
      },
    });

    return savedProfile;
  }

  /**
   * Find student profile by userId
   */
  async findByUserId(
    userId: string,
    relations: string[] = [],
  ): Promise<StudentProfile | null> {
    return await this.studentProfileRepo.findOne({
      where: { userId },
      relations,
    });
  }

  /**
   * Update subjects for a student's exam type
   */
  async updateExamTypeSubjects(
    studentProfileId: string,
    examTypeId: string,
    subjectIds: string[],
  ): Promise<void> {
    const studentExamType = await this.studentExamTypeRepo.findOne({
      where: { studentId: studentProfileId, examTypeId },
    });

    if (!studentExamType) return;

    await this.studentExamTypeSubjectRepo.delete({
      studentExamTypeId: studentExamType.id,
    });

    const subjects = subjectIds.map((subjectId) =>
      this.studentExamTypeSubjectRepo.create({
        studentExamTypeId: studentExamType.id,
        subjectId,
      }),
    );

    await this.studentExamTypeSubjectRepo.save(subjects);
  }

  /**
   * Get student dashboard data for a given exam type and time period
   */
  async getStudentDashboard(
    userId: string,
    examTypeId?: string,
    granularity: 'day' | 'week' | 'month' = 'month',
    timezone: string = 'UTC',
  ) {
    const student = await this.studentProfileRepo.findOne({
      where: { userId },
      relations: ['user'],
    });

    if (!student) {
      throw new NotFoundException('Student profile not found');
    }

    // Load all StudentExamType records for this student
    const studentExamTypes = await this.studentExamTypeRepo.find({
      where: { studentId: student.id },
      relations: ['examType'],
    });

    // Validate and resolve which exam type to use
    // Falls back to lastExamTypeId (persisted choice), then defaultExamTypeId
    const resolvedExamTypeId = this.validateExamType(
      studentExamTypes,
      examTypeId,
      student.lastExamTypeId || student.defaultExamTypeId,
    );

    // Reconcile subscription state for the resolved exam type:
    // expires ACTIVE/CANCELLED past endDate, promotes SCHEDULED subs.
    if (resolvedExamTypeId) {
      await this.subscriptionsService.reconcileStudentSub(
        student.id,
        resolvedExamTypeId,
      );
    }

    // Re-fetch currentStudentExamType after reconcile (isPaid may have changed)
    // Must include examType relation — used for name, minSubjectsSelectable, maxSubjectsSelectable etc.
    const currentStudentExamType = resolvedExamTypeId
      ? await this.studentExamTypeRepo.findOne({
          where: { studentId: student.id, examTypeId: resolvedExamTypeId },
          relations: ['examType'],
        })
      : null;

    // Subjects for current exam type
    const selectedSubjects = currentStudentExamType
      ? await this.studentExamTypeSubjectRepo.find({
          where: { studentExamTypeId: currentStudentExamType.id },
          relations: ['subject'],
        })
      : [];

    // Stats — all scoped to the current exam type
    const examTypeStatsRaw = await this.examAttemptRepo
      .createQueryBuilder('ea')
      .select('COUNT(*)', 'totalExams')
      .addSelect('COALESCE(SUM(ea.correctAnswers), 0)', 'totalCorrect')
      .addSelect('COALESCE(SUM(ea.wrongAnswers), 0)', 'totalWrong')
      .where('ea.studentId = :studentId', { studentId: student.id })
      .andWhere('ea.examTypeId = :examTypeId', {
        examTypeId: resolvedExamTypeId,
      })
      .andWhere('ea.status IN (:...statuses)', {
        statuses: [
          ExamAttemptStatus.COMPLETED,
          ExamAttemptStatus.AUTO_SUBMITTED,
        ],
      })
      .getRawOne<{
        totalExams: string;
        totalCorrect: string;
        totalWrong: string;
      }>();

    // Per-subject: count unique questions practiced per subject (for "Math: 12/40" display)
    const subjectProgressRows =
      selectedSubjects.length > 0
        ? await this.questionProgressRepo
            .createQueryBuilder('qp')
            .select('ets."subjectId"', 'subjectId')
            .addSelect('COUNT(DISTINCT qp."questionId")', 'count')
            .innerJoin('questions', 'q', 'q.id = qp."questionId"')
            .innerJoin(
              'exam_type_subjects',
              'ets',
              'ets.id = q."examTypeSubjectId"',
            )
            .where('qp."studentId" = :studentId', { studentId: student.id })
            .andWhere('ets."examTypeId" = :examTypeId', {
              examTypeId: resolvedExamTypeId,
            })
            .groupBy('ets."subjectId"')
            .getRawMany<{ subjectId: string; count: string }>()
        : [];
    const subjectProgressMap = new Map(
      subjectProgressRows.map((r) => [r.subjectId, parseInt(r.count, 10)]),
    );

    // Count unique questions practiced via question_progress (joins through questions → exam_type_subjects)
    const totalQuestionsSolved = await this.questionProgressRepo
      .createQueryBuilder('qp')
      .innerJoin('questions', 'q', 'q.id = qp."questionId"')
      .innerJoin('exam_type_subjects', 'ets', 'ets.id = q."examTypeSubjectId"')
      .where('qp."studentId" = :studentId', { studentId: student.id })
      .andWhere('ets."examTypeId" = :examTypeId', {
        examTypeId: resolvedExamTypeId,
      })
      .getCount();

    const totalExamsCompleted = parseInt(
      examTypeStatsRaw?.totalExams ?? '0',
      10,
    );
    const totalCorrect = parseInt(examTypeStatsRaw?.totalCorrect ?? '0', 10);
    const totalWrong = parseInt(examTypeStatsRaw?.totalWrong ?? '0', 10);
    const overallAccuracy =
      totalCorrect + totalWrong > 0
        ? Math.round((totalCorrect / (totalCorrect + totalWrong)) * 100)
        : 0;

    // Flags
    const hasPremiumOnAnyExam = studentExamTypes.some((set) => set.isPaid);

    const defaultStudentExamType = studentExamTypes.find(
      (set) => set.examTypeId === student.defaultExamTypeId,
    );
    const hasSelectedDefaultSubjects = defaultStudentExamType
      ? (await this.studentExamTypeSubjectRepo.count({
          where: { studentExamTypeId: defaultStudentExamType.id },
        })) > 0
      : false;

    // Subject score chart data, streak, and accuracy delta (parallel)
    const [subjectScores, accuracyDelta] = await Promise.all([
      this.analyticsService.getSubjectScoresForChart(
        student.id,
        resolvedExamTypeId!,
        { granularity, timezone },
      ),
      resolvedExamTypeId
        ? this.analyticsService.getMonthlyAccuracyDelta(
            student.id,
            resolvedExamTypeId,
          )
        : Promise.resolve({ thisMonth: null, lastMonth: null, delta: null }),
    ]);
    const streak = await this.analyticsService.getStudentStreak(student.id);

    // Fetch ALL exam types (not just student's subscribed ones)
    const allExamTypes = await this.examsService.getAllExamTypes();

    // Build exams available with subscription status
    const examsAvailable = allExamTypes.map((examType) => {
      const studentExamType = studentExamTypes.find(
        (set) => set.examTypeId === examType.id,
      );
      return {
        id: examType.id,
        name: examType.name,
        description: examType.description,
        isSubscribed: !!studentExamType,
        isPaid: studentExamType?.isPaid || false,
        isDemoAllowed: studentExamType?.isDemoAllowed || false,
        isDefault: examType.id === student.defaultExamTypeId,
        isCurrent: examType.id === resolvedExamTypeId,
      };
    });

    // Allowed exam types for switcher (only subscribed ones)
    const allowedExamTypes = studentExamTypes.map((set) => ({
      id: set.examType.id,
      name: set.examType.name,
      isPaid: set.isPaid,
      isDemoAllowed: set.isDemoAllowed,
    }));

    return {
      meta: {
        userJoinedAt: student.createdAt,
        dataAvailableSince: student.createdAt,
        allowedDateRange: {
          min: student.createdAt,
          max: new Date(),
        },
      },
      student: {
        id: student.id,
        firstName: student.user.firstName,
        lastName: student.user.lastName,
        email: student.user.email,
        defaultExamTypeId: student.defaultExamTypeId,
        lastExamTypeId: student.lastExamTypeId || student.defaultExamTypeId,
        hasEverSubscribed: student.hasEverSubscribed ?? false,
        isSponsored: student.isSponsored ?? false,
        sponsorDisplayName: student.sponsorDisplayName ?? null,
      },
      currentExamType: {
        id: resolvedExamTypeId || null,
        name: currentStudentExamType?.examType?.name || null,
        isPaid: currentStudentExamType?.isPaid || false,
        isDemoAllowed: currentStudentExamType?.isDemoAllowed || false,
        hasSelectedSubjects: selectedSubjects.length > 0,
        minSubjectsSelectable:
          currentStudentExamType?.examType?.minSubjectsSelectable || 1,
        maxSubjectsSelectable:
          currentStudentExamType?.examType?.maxSubjectsSelectable || 9,
        freeTierQuestionLimit:
          currentStudentExamType?.examType?.freeTierQuestionLimit || 50,
        supportedCategories: currentStudentExamType?.examType
          ?.supportedCategories ?? ['objectives'],
      },
      selectedSubjects: selectedSubjects.map((s) => ({
        id: s.subject.id,
        name: s.subject.name,
        questionsAttempted: subjectProgressMap.get(s.subject.id) ?? 0,
      })),
      stats: {
        totalExamsCompleted,
        totalSubjectsSelected: selectedSubjects.length,
        totalQuestionsSolved,
        totalCorrect,
        totalWrong,
        overallAccuracy,
      },
      flags: {
        hasSelectedDefaultSubjects,
        hasPremiumOnAnyExam,
        showGoPremiumModal: !hasPremiumOnAnyExam,
      },
      analytics: {
        subjectScores,
      },
      streak: {
        currentStreak: streak.currentStreak,
        longestStreak: streak.longestStreak,
      },
      accuracyDelta,
      allowedExamTypes,
      examsAvailable,
    };
  }

  /**
   * Get subject scores for a specific time period (for chart updates without full dashboard refetch)
   */
  async getSubjectScores(
    userId: string,
    examTypeId: string,
    granularity: 'day' | 'week' | 'month' = 'month',
    timezone: string = 'UTC',
  ) {
    const student = await this.studentProfileRepo.findOne({
      where: { userId },
    });

    if (!student) {
      throw new NotFoundException('Student profile not found');
    }

    // Validate exam type access
    const studentExamTypes = await this.studentExamTypeRepo.find({
      where: { studentId: student.id },
    });

    const resolvedExamTypeId = this.validateExamType(
      studentExamTypes,
      examTypeId,
      student.lastExamTypeId || student.defaultExamTypeId,
    );

    const subjectScores = await this.analyticsService.getSubjectScoresForChart(
      student.id,
      resolvedExamTypeId!,
      { granularity, timezone },
    );

    return subjectScores;
  }

  /**
   * Validates and resolves which exam type the student should see.
   *   1. null/empty requested → return default
   *   2. No StudentExamType relation found → return default
   *   3. Is the default exam type → allow
   *   4. Not default → must be paid to access, otherwise fall back to default
   */
  private validateExamType(
    studentExamTypes: StudentExamType[],
    requestedExamTypeId: string | undefined | null,
    defaultExamTypeId: string | null,
  ): string | null {
    if (!requestedExamTypeId) {
      return defaultExamTypeId;
    }

    const match = studentExamTypes.find(
      (set) => set.examTypeId === requestedExamTypeId,
    );

    if (!match) {
      return defaultExamTypeId;
    }

    if (match.examTypeId === defaultExamTypeId) {
      return match.examTypeId;
    }

    if (!match.isPaid) {
      return defaultExamTypeId;
    }

    return match.examTypeId;
  }

  /**
   * Updates the student's lastExamTypeId after validating access.
   */
  async updateLastExamType(userId: string, examTypeId: string): Promise<void> {
    const student = await this.studentProfileRepo.findOne({
      where: { userId },
    });

    if (!student) {
      throw new NotFoundException('Student profile not found');
    }

    const studentExamTypes = await this.studentExamTypeRepo.find({
      where: { studentId: student.id },
    });

    const validatedExamTypeId = this.validateExamType(
      studentExamTypes,
      examTypeId,
      student.defaultExamTypeId,
    );

    student.lastExamTypeId = validatedExamTypeId as string;
    await this.studentProfileRepo.save(student);
  }

  /**
   * Updates subjects for a student's exam type.
   * Validates min/max subject constraints from the exam type.
   */
  async updateSubjects(
    userId: string,
    examTypeId: string,
    subjectIds: string[],
  ): Promise<{ selectedSubjects: { id: string; name: string }[] }> {
    const student = await this.studentProfileRepo.findOne({
      where: { userId },
    });

    if (!student) {
      throw new NotFoundException('Student profile not found');
    }

    // Find the student's exam type record
    const studentExamType = await this.studentExamTypeRepo.findOne({
      where: { studentId: student.id, examTypeId },
      relations: ['examType'],
    });

    if (!studentExamType) {
      throw new BadRequestException('You do not have access to this exam type');
    }

    const { minSubjectsSelectable, maxSubjectsSelectable } =
      studentExamType.examType;

    // Validate subject count
    if (subjectIds.length < minSubjectsSelectable) {
      throw new BadRequestException(
        `Please select at least ${minSubjectsSelectable} subject${minSubjectsSelectable > 1 ? 's' : ''}`,
      );
    }

    if (subjectIds.length > maxSubjectsSelectable) {
      throw new BadRequestException(
        `Please select at most ${maxSubjectsSelectable} subject${maxSubjectsSelectable > 1 ? 's' : ''}`,
      );
    }

    // Validate that all subjects exist and belong to this exam type
    const subjects =
      await this.examsService.findSubjectsWithExamTypes(subjectIds);

    if (subjects.length !== subjectIds.length) {
      throw new BadRequestException('One or more subjects are invalid');
    }

    // Validate all belong to this exam type via ExamTypeSubject join
    const invalidSubjects = subjects.filter(
      (s) => !s.examTypeSubjects.some((ets) => ets.examTypeId === examTypeId),
    );

    if (invalidSubjects.length > 0) {
      throw new BadRequestException(
        'One or more subjects do not belong to this exam type',
      );
    }

    // Remove existing subjects for this exam type
    await this.studentExamTypeSubjectRepo.delete({
      studentExamTypeId: studentExamType.id,
    });

    // Add new subjects
    const newSubjects = subjectIds.map((subjectId) =>
      this.studentExamTypeSubjectRepo.create({
        studentExamTypeId: studentExamType.id,
        subjectId,
      }),
    );

    await this.studentExamTypeSubjectRepo.save(newSubjects);

    // Log the update
    await this.loggerService.log({
      userId,
      action: LogActionTypes.UPDATE,
      description: 'Student updated subjects',
      metadata: {
        examTypeId,
        subjectIds,
      },
    });

    // Return the updated subjects
    return {
      selectedSubjects: subjects.map((s) => ({
        id: s.id,
        name: s.name,
      })),
    };
  }

  create(_createStudentDto: CreateStudentDto) {
    return 'This action adds a new student';
  }

  findAll() {
    return `This action returns all students`;
  }

  findOne(id: number) {
    return `This action returns a #${id} student`;
  }

  update(id: number, _updateStudentDto: UpdateStudentDto) {
    return `This action updates a #${id} student`;
  }

  remove(id: number) {
    return `This action removes a #${id} student`;
  }

  /**
   * Get paginated exam attempt history for a student.
   * Only returns COMPLETED attempts, newest first.
   */
  async getExamHistory(
    userId: string,
    page = 1,
    limit = 10,
  ): Promise<{ data: any[]; total: number; page: number }> {
    const profile = await this.findByUserId(userId);
    if (!profile) return { data: [], total: 0, page };

    const skip = (page - 1) * limit;

    const [attempts, total] = await this.examAttemptRepo.findAndCount({
      where: { studentId: profile.id, status: ExamAttemptStatus.COMPLETED },
      relations: ['examType'],
      order: { startedAt: 'DESC' },
      skip,
      take: limit,
    });

    const data = attempts.map((attempt) => ({
      id: attempt.id,
      mode: attempt.mode,
      examTypeName: attempt.examType?.name ?? 'Unknown',
      totalQuestions: attempt.totalQuestions,
      scorePercentage: attempt.scorePercentage,
      timeSpentSeconds: attempt.timeSpentSeconds,
      startedAt: attempt.startedAt,
      completedAt: attempt.completedAt,
      status: attempt.status,
    }));

    return { data, total, page };
  }

  /**
   * Get full detail for a single completed exam attempt.
   * Returns attempt metadata + questionStatuses (all questions, lightweight)
   * + the first page of detailedResults (paginated).
   * questionStatuses powers the navigator pills without loading full content.
   */
  async getExamAttemptDetail(
    userId: string,
    attemptId: string,
    offset = 0,
    limit = 20,
  ): Promise<any> {
    const profile = await this.findByUserId(userId);
    if (!profile) throw new NotFoundException('Student profile not found');

    const attempt = await this.examAttemptRepo.findOne({
      where: { id: attemptId, studentId: profile.id },
      relations: ['examType'],
    });
    if (!attempt) throw new NotFoundException('Exam attempt not found');

    // Fetch subject names
    const subjectIds: string[] = attempt.selectedSubjects ?? [];
    let subjectNames: string[] = [];
    if (subjectIds.length > 0) {
      const subjects = await this.examsService.findSubjectsByIds(subjectIds);
      subjectNames = subjects.map((s) => s.name);
    }

    const questionIds: string[] = attempt.questionIds ?? [];
    const responseMap = new Map(
      (attempt.questionResponses ?? []).map((r) => [r.questionId, r]),
    );

    // Lightweight status for ALL questions — powers navigator pill colours
    const questionStatuses = questionIds.map((qId) => {
      const r = responseMap.get(qId);
      return {
        questionId: qId,
        isCorrect: r?.isCorrect ?? null,
        exemptFromMetrics: r?.exemptFromMetrics ?? false,
      };
    });

    // Paginated detailed results for the requested page only
    const pageIds = questionIds.slice(offset, offset + limit);
    const detailedResults = await this.buildDetailedResults(
      pageIds,
      responseMap,
    );

    const essayQuestions = (attempt.questionResponses ?? []).filter(
      (r) => r.exemptFromMetrics,
    ).length;

    return {
      id: attempt.id,
      mode: attempt.mode,
      examTypeName: attempt.examType?.name ?? 'Unknown',
      subjectNames,
      totalQuestions: attempt.totalQuestions,
      totalCount: questionIds.length,
      correctAnswers: attempt.correctAnswers,
      wrongAnswers: attempt.wrongAnswers,
      unanswered: attempt.unanswered,
      essayQuestions,
      scorePercentage: attempt.scorePercentage,
      totalMarksObtained: attempt.totalMarksObtained,
      totalMarksPossible: attempt.totalMarksPossible,
      timeSpentSeconds: attempt.timeSpentSeconds,
      timeLimitSeconds: attempt.timeLimitSeconds ?? null,
      startedAt: attempt.startedAt,
      completedAt: attempt.completedAt,
      status: attempt.status,
      questionStatuses,
      detailedResults,
    };
  }

  /**
   * Paginated detailed results for a past attempt — no metadata.
   * Used by the frontend page cache when navigating past the initial 20 questions.
   */
  async getExamAttemptQuestions(
    userId: string,
    attemptId: string,
    offset: number,
    limit: number,
  ): Promise<any> {
    const profile = await this.findByUserId(userId);
    if (!profile) throw new NotFoundException('Student profile not found');

    const attempt = await this.examAttemptRepo.findOne({
      where: { id: attemptId, studentId: profile.id },
    });
    if (!attempt) throw new NotFoundException('Exam attempt not found');

    const questionIds: string[] = attempt.questionIds ?? [];
    const pageIds = questionIds.slice(offset, offset + limit);
    if (pageIds.length === 0) return { detailedResults: [] };

    const responseMap = new Map(
      (attempt.questionResponses ?? []).map((r) => [r.questionId, r]),
    );
    const detailedResults = await this.buildDetailedResults(
      pageIds,
      responseMap,
    );

    return { detailedResults };
  }

  /**
   * Shared helper: fetch questions by ID and merge with stored responses.
   */
  private async buildDetailedResults(
    pageIds: string[],
    responseMap: Map<string, any>,
  ): Promise<any[]> {
    if (pageIds.length === 0) return [];

    const questions =
      await this.examsService.findQuestionsWithPassages(pageIds);
    const questionMap = new Map(questions.map((q) => [q.id, q]));

    return pageIds
      .map((qId) => {
        const q = questionMap.get(qId);
        const r = responseMap.get(qId);
        if (!q) return null;

        return {
          questionId: q.id,
          questionText: q.questionText,
          questionType: q.type,
          topicId: q.topicId ?? null,
          topicName: q.topic?.name ?? null,
          explanationShort: q.explanationShort ?? null,
          explanationLong: q.explanationLong ?? null,
          marks: q.marks,
          passageId: q.passageId ?? null,
          passage: q.passage
            ? {
                id: q.passage.id,
                title: q.passage.title,
                content: q.passage.content,
              }
            : null,
          options: (q.options ?? []).map((opt) => ({
            id: opt.id,
            text: opt.text,
          })),
          correctAnswer: q.correctAnswer ?? null,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          studentAnswer: r?.answer ?? null,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          isCorrect: r?.isCorrect ?? null,
        };
      })
      .filter(Boolean);
  }

  // ─── Methods used by ExamsService (cross-resource delegation) ────────────

  /** Find a student's exam type record with the examType relation loaded. */
  async findStudentExamType(
    studentId: string,
    examTypeId: string,
  ): Promise<StudentExamType | null> {
    return this.studentExamTypeRepo.findOne({
      where: { studentId, examTypeId },
      relations: ['examType'],
    });
  }

  /** Create and persist a new ExamAttempt. */
  async createExamAttempt(
    data: DeepPartial<ExamAttempt>,
  ): Promise<ExamAttempt> {
    const attempt = this.examAttemptRepo.create(data);
    return this.examAttemptRepo.save(attempt);
  }

  /** Find an ExamAttempt by id scoped to a specific student. */
  async findExamAttemptById(
    id: string,
    studentId: string,
  ): Promise<ExamAttempt | null> {
    return this.examAttemptRepo.findOne({ where: { id, studentId } });
  }

  /** Persist a mutated ExamAttempt (used by ExamsService after grading). */
  async saveExamAttempt(attempt: ExamAttempt): Promise<ExamAttempt> {
    return this.examAttemptRepo.save(attempt);
  }

  /** Return the IDs of questions the student has flagged within a given set. */
  async getFlaggedQuestionIds(
    studentId: string,
    questionIds: string[],
  ): Promise<string[]> {
    if (questionIds.length === 0) return [];
    const flags = await this.flaggedQuestionRepo.find({
      where: { studentId, questionId: In(questionIds) },
      select: ['questionId'],
    });
    return flags.map((f) => f.questionId);
  }

  /** Create or update a flagged question record. */
  async upsertFlaggedQuestion(
    studentId: string,
    questionId: string,
    data: { flagType?: string; reason?: string },
  ): Promise<void> {
    const existing = await this.flaggedQuestionRepo.findOne({
      where: { studentId, questionId },
    });
    if (existing) {
      existing.flagType = (data.flagType ?? FlagReasons.ERROR) as FlagReasons;
      if (data.reason !== undefined) existing.reason = data.reason;
      existing.flaggedAt = new Date();
      await this.flaggedQuestionRepo.save(existing);
    } else {
      const newFlag = this.flaggedQuestionRepo.create({
        studentId,
        questionId,
        flagType: (data.flagType ?? FlagReasons.ERROR) as FlagReasons,
        reason: data.reason ?? undefined,
        adminReviewed: false,
        flaggedAt: new Date(),
      });
      await this.flaggedQuestionRepo.save(newFlag);
    }
  }

  /** Remove a flagged question if it exists. */
  async removeFlaggedQuestion(
    studentId: string,
    questionId: string,
  ): Promise<void> {
    const existing = await this.flaggedQuestionRepo.findOne({
      where: { studentId, questionId },
    });
    if (existing) await this.flaggedQuestionRepo.remove(existing);
  }

  /** Upsert a QuestionProgress record after a student answers a question. */
  async updateQuestionProgress(
    studentId: string,
    questionId: string,
    isCorrect: boolean | null,
    exemptFromMetrics?: boolean,
  ): Promise<void> {
    if (exemptFromMetrics) return;

    let progress = await this.questionProgressRepo.findOne({
      where: { studentId, questionId },
    });

    if (!progress) {
      progress = this.questionProgressRepo.create({
        studentId,
        questionId,
        timesAttempted: 0,
        timesCorrect: 0,
        timesWrong: 0,
      });
    }

    progress.timesAttempted++;
    if (isCorrect === true) progress.timesCorrect++;
    else if (isCorrect === false) progress.timesWrong++;
    progress.isDone = true;
    progress.lastAttempted = new Date();

    await this.questionProgressRepo.save(progress);
  }

  /** Increment the student's cached lifetime metrics after an exam is submitted. */
  async incrementLifetimeMetrics(
    studentId: string,
    totalAttempted: number,
    correctAnswers: number,
    wrongAnswers: number,
  ): Promise<void> {
    if (totalAttempted === 0) return;
    const student = await this.studentProfileRepo.findOne({
      where: { id: studentId },
    });
    if (!student) return;
    student.totalQuestionsSolved += totalAttempted;
    student.totalCorrect += correctAnswers;
    student.totalWrong += wrongAnswers;
    student.overallAccuracy =
      student.totalQuestionsSolved > 0
        ? (student.totalCorrect / student.totalQuestionsSolved) * 100
        : 0;
    await this.studentProfileRepo.save(student);
  }

  // ─── Analytics Read Methods ──────────────────────────────────────

  /**
   * Chart 1 — Average accuracy per subject for a custom date range.
   * Simple aggregation: group by subject, return [{ name, Score }].
   */
  async getAnalyticsSubjectScores(
    studentId: string,
    examTypeId: string,
    startDate: string | undefined,
    endDate: string | undefined,
  ) {
    return this.analyticsService.getAnalyticsSubjectScoresBySubject(
      studentId,
      examTypeId,
      startDate,
      endDate,
    );
  }

  /**
   * Chart 2 — Accuracy over time, calendar-relative (no period param).
   */
  async getAnalyticsProgressOverTime(
    studentId: string,
    examTypeId: string,
    granularity: 'day' | 'week' | 'month',
    timezone: string,
  ) {
    return this.analyticsService.getAnalyticsProgressOverTime(
      studentId,
      examTypeId,
      granularity,
      timezone,
    );
  }

  /**
   * Chart 3 — All-time question distribution: correct vs wrong for student+examType.
   * Queries question_progress JOIN questions JOIN exam_type_subjects.
   */
  async getAnalyticsQuestionDistribution(
    studentId: string,
    examTypeId: string,
  ): Promise<{ correct: number; wrong: number; unanswered: number }> {
    const rows = await this.questionProgressRepo
      .createQueryBuilder('qp')
      .select('SUM(qp."timesCorrect")', 'correct')
      .addSelect('SUM(qp."timesWrong")', 'wrong')
      .innerJoin('questions', 'q', 'q.id = qp."questionId"')
      .innerJoin('exam_type_subjects', 'ets', 'ets.id = q."examTypeSubjectId"')
      .where('qp."studentId" = :studentId', { studentId })
      .andWhere('ets."examTypeId" = :examTypeId', { examTypeId })
      .getRawOne<{ correct: string; wrong: string }>()
      .catch(() => null);

    const correct = parseInt(rows?.correct ?? '0', 10);
    const wrong = parseInt(rows?.wrong ?? '0', 10);
    return { correct, wrong, unanswered: 0 };
  }

  /**
   * Chart 4 — Student ranking among peers for a given examType.
   * Ranked by average score (highest avg score = rank #1). Optional date range filter.
   * Bar height = avg score percentage. Also computes examCountRank (more exams = rank #1).
   */
  async getAnalyticsStudentRanking(
    studentId: string,
    examTypeId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<{
    rank: number;
    examCountRank: number;
    totalStudents: number;
    percentile: number;
    chartData: { label: string; score: number; isCurrentStudent: boolean }[];
  }> {
    let query = this.examAttemptRepo
      .createQueryBuilder('ea')
      .select('ea."studentId"', 'studentId')
      .addSelect('AVG(ea."scorePercentage")', 'avgScore')
      .addSelect('COUNT(ea.id)', 'examCount')
      .where('ea."examTypeId" = :examTypeId', { examTypeId })
      .andWhere('ea.status = :status', { status: 'completed' });

    if (startDate) {
      query = query.andWhere('ea."completedAt" >= :start', {
        start: new Date(startDate + 'T00:00:00Z'),
      });
    }
    if (endDate) {
      query = query.andWhere('ea."completedAt" <= :end', {
        end: new Date(endDate + 'T23:59:59Z'),
      });
    }

    const [rows, totalStudents] = await Promise.all([
      query
        .groupBy('ea."studentId"')
        .orderBy('"avgScore"', 'DESC')
        .getRawMany<{
          studentId: string;
          avgScore: string;
          examCount: string;
        }>()
        .catch(() => []),
      // Total = all students enrolled for this exam type, not just those who wrote exams
      this.studentExamTypeRepo.count({ where: { examTypeId } }).catch(() => 0),
    ]);

    const denominator = Math.max(totalStudents, rows.length, 1);

    if (rows.length === 0) {
      return {
        rank: denominator,
        examCountRank: denominator,
        totalStudents: denominator,
        percentile: 0,
        chartData: [],
      };
    }

    // Avg score rank (highest avg score = rank #1)
    // Students who haven't written exams sit below all exam writers, so rank = denominator
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const myIndex = rows.findIndex((r: any) => r.studentId === studentId);
    const rank = myIndex === -1 ? denominator : myIndex + 1;
    const percentile = Math.round(
      ((denominator - rank) / Math.max(denominator - 1, 1)) * 100,
    );

    // Exam count rank (most exams completed = rank #1)
    const rowsByExamCount = [...rows].sort(
      (a, b) => parseInt(b.examCount, 10) - parseInt(a.examCount, 10),
    );
    const myExamCountIndex = rowsByExamCount.findIndex(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      (r: any) => r.studentId === studentId,
    );
    const examCountRank =
      myExamCountIndex === -1 ? denominator : myExamCountIndex + 1;

    // Cap to 25 bars: show ~12 on each side of the student
    const CAP = 25;
    let sliceStart = 0;
    let sliceEnd = rows.length;
    if (rows.length > CAP) {
      const center = myIndex === -1 ? 0 : myIndex;
      sliceStart = Math.max(0, center - Math.floor(CAP / 2));
      sliceEnd = Math.min(rows.length, sliceStart + CAP);
      if (sliceEnd - sliceStart < CAP) {
        sliceStart = Math.max(0, sliceEnd - CAP);
      }
    }

    const chartData = rows.slice(sliceStart, sliceEnd).map((r, i) => ({
      label: `#${sliceStart + i + 1}`,
      score: Math.round(parseFloat(r.avgScore) * 10) / 10,
      isCurrentStudent: r.studentId === studentId,
    }));

    return {
      rank,
      examCountRank,
      totalStudents: denominator,
      percentile,
      chartData,
    };
  }

  /**
   * Chart 5 — Subject attempts for a period.
   * For day granularity: queries exam_attempts directly for that specific date,
   * extracts questionIds, batch-queries subject per question, counts per subject.
   * This is accurate even with multiple attempts on the same day.
   * For week/month: delegates to AnalyticsService (aggregated table).
   */
  async getAnalyticsSubjectAttempts(
    studentId: string,
    examTypeId: string,
    granularity: 'day' | 'week' | 'month',
    period: string | undefined,
    timezone: string,
  ) {
    if (granularity === 'day') {
      return this.getDailySubjectAttemptsDirect(studentId, examTypeId, period);
    }
    return this.analyticsService.getAnalyticsSubjectAttempts(
      studentId,
      examTypeId,
      granularity,
      period,
      timezone,
    );
  }

  /**
   * Chart 5 (day granularity) — Query exam_attempts directly for that specific day,
   * flatten all questionIds, batch-query question→subject mapping, count per subject.
   * This bypasses the aggregated analytics table for accurate per-day data.
   */
  private async getDailySubjectAttemptsDirect(
    studentId: string,
    examTypeId: string,
    date: string | undefined,
  ): Promise<
    { subjectId: string; subjectName: string; questionsAttempted: number }[]
  > {
    const targetDate = date ? new Date(date + 'T00:00:00Z') : new Date();
    const dayStart = new Date(targetDate);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(targetDate);
    dayEnd.setUTCHours(23, 59, 59, 999);

    // 1. Fetch all completed attempts for this student/examType on the target day
    const dayAttempts = await this.examAttemptRepo
      .createQueryBuilder('ea')
      .select('ea."questionIds"', 'questionIds')
      .where('ea."studentId" = :studentId', { studentId })
      .andWhere('ea."examTypeId" = :examTypeId', { examTypeId })
      .andWhere('ea.status = :status', { status: ExamAttemptStatus.COMPLETED })
      .andWhere('ea."completedAt" >= :dayStart', { dayStart })
      .andWhere('ea."completedAt" <= :dayEnd', { dayEnd })
      .getRawMany<{ questionIds: string[] }>()
      .catch(() => []);

    // 2. Flatten all questionIds from the day's attempts (keep duplicates for count)
    const allQuestionIds: string[] = [];
    for (const row of dayAttempts) {
      const ids: string[] = Array.isArray(row.questionIds)
        ? row.questionIds
        : [];
      allQuestionIds.push(...ids);
    }

    if (allQuestionIds.length === 0) return [];

    // 3. Batch-query questions → subjects (deduplicate for the JOIN, count separately)
    const uniqueIds = [...new Set(allQuestionIds)];
    const questionSubjectRows = await this.examAttemptRepo.manager
      .createQueryBuilder()
      .select('q.id', 'questionId')
      .addSelect('s.id', 'subjectId')
      .addSelect('s.name', 'subjectName')
      .from('questions', 'q')
      .innerJoin('exam_type_subjects', 'ets', 'ets.id = q."examTypeSubjectId"')
      .innerJoin('subjects', 's', 's.id = ets."subjectId"')
      .where('q.id IN (:...ids)', { ids: uniqueIds })
      .andWhere('ets."examTypeId" = :examTypeId', { examTypeId })
      .getRawMany<{
        questionId: string;
        subjectId: string;
        subjectName: string;
      }>()
      .catch(() => []);

    // 4. Build questionId → subject mapping
    const questionSubjectMap = new Map<
      string,
      { subjectId: string; subjectName: string }
    >();
    for (const row of questionSubjectRows) {
      questionSubjectMap.set(row.questionId, {
        subjectId: row.subjectId,
        subjectName: row.subjectName,
      });
    }

    // 5. Count per subject (including duplicates from multiple attempts)
    const subjectCountMap = new Map<
      string,
      { subjectId: string; subjectName: string; count: number }
    >();
    for (const qId of allQuestionIds) {
      const subject = questionSubjectMap.get(qId);
      if (!subject) continue;
      const existing = subjectCountMap.get(subject.subjectId);
      if (existing) {
        existing.count++;
      } else {
        subjectCountMap.set(subject.subjectId, { ...subject, count: 1 });
      }
    }

    return Array.from(subjectCountMap.values())
      .map((s) => ({
        subjectId: s.subjectId,
        subjectName: s.subjectName,
        questionsAttempted: s.count,
      }))
      .sort((a, b) => b.questionsAttempted - a.questionsAttempted);
  }

  /**
   * Records a daily check-in for streak tracking.
   * Called by StudentActivityInterceptor on every authenticated request.
   * Fire-and-forget - errors are silently ignored.
   */
  // ─── Sponsor-related queries ─────────────────────────────────────────────

  /** Paginated list of sponsored students with their user info. */
  async findSponsoredStudents(
    sponsorId: string,
    page: number,
    limit: number,
  ): Promise<{ students: StudentProfile[]; total: number }> {
    const [students, total] = await this.studentProfileRepo.findAndCount({
      where: { sponsorId },
      relations: ['user'],
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });
    return { students, total };
  }

  /** Count of all sponsored students for a sponsor. */
  async countSponsoredStudents(sponsorId: string): Promise<number> {
    return this.studentProfileRepo.count({ where: { sponsorId } });
  }

  /** Count of sponsored students whose user account is active. */
  async countActiveSponsoredStudents(sponsorId: string): Promise<number> {
    return this.studentProfileRepo
      .createQueryBuilder('sp')
      .leftJoin('sp.user', 'u')
      .where('sp.sponsorId = :sponsorId', { sponsorId })
      .andWhere('u.isActive = true')
      .getCount();
  }

  /** Count of sponsored students added this month vs last month. */
  async getSponsoredStudentMonthlyStats(sponsorId: string): Promise<{
    thisMonth: number;
    lastMonth: number;
  }> {
    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    startOfThisMonth.setHours(0, 0, 0, 0);

    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    startOfLastMonth.setHours(0, 0, 0, 0);

    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    endOfLastMonth.setHours(23, 59, 59, 999);

    const [thisMonth, lastMonth] = await Promise.all([
      this.studentProfileRepo
        .createQueryBuilder('sp')
        .where('sp.sponsorId = :sponsorId', { sponsorId })
        .andWhere('sp.createdAt >= :start', { start: startOfThisMonth })
        .getCount(),
      this.studentProfileRepo
        .createQueryBuilder('sp')
        .where('sp.sponsorId = :sponsorId', { sponsorId })
        .andWhere('sp.createdAt >= :start', { start: startOfLastMonth })
        .andWhere('sp.createdAt <= :end', { end: endOfLastMonth })
        .getCount(),
    ]);

    return { thisMonth, lastMonth };
  }

  /** 5 most recently added sponsored students with user info. */
  async getRecentSponsoredStudents(
    sponsorId: string,
    limit = 5,
  ): Promise<StudentProfile[]> {
    return this.studentProfileRepo.find({
      where: { sponsorId },
      relations: ['user'],
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /** Total exams completed + average score for all sponsored students. */
  async getSponsoredExamStats(sponsorId: string): Promise<{
    totalExams: number;
    avgScore: number;
  }> {
    const result = await this.examAttemptRepo
      .createQueryBuilder('ea')
      .leftJoin('ea.student', 'sp')
      .where('sp.sponsorId = :sponsorId', { sponsorId })
      .andWhere('ea.status = :status', { status: 'completed' })
      .select('COUNT(ea.id)', 'totalExams')
      .addSelect('AVG(ea.scorePercentage)', 'avgScore')
      .getRawOne<{ totalExams: string; avgScore: string }>();

    return {
      totalExams: parseInt(result?.totalExams ?? '0', 10),
      avgScore: parseFloat(result?.avgScore ?? '0'),
    };
  }

  /**
   * Find a specific sponsored student by their profile ID and verify they belong to the sponsor.
   * Used by sponsor analytics routes to gate access.
   */
  async findSponsoredStudentById(
    sponsorId: string,
    studentProfileId: string,
  ): Promise<StudentProfile> {
    const student = await this.studentProfileRepo.findOne({
      where: { id: studentProfileId, sponsorId },
    });
    if (!student)
      throw new NotFoundException('Student not found or not sponsored by you.');
    return student;
  }

  /** Batch version — returns only the profiles that actually belong to this sponsor. */
  async findSponsoredStudentsByIds(
    sponsorId: string,
    studentProfileIds: string[],
  ): Promise<StudentProfile[]> {
    if (!studentProfileIds.length) return [];
    return this.studentProfileRepo.find({
      where: { id: In(studentProfileIds), sponsorId },
      select: ['id'],
    });
  }

  /** Update sponsorship info on a student profile (for sponsor URL signup). */
  async updateStudentSponsorInfo(
    studentProfileId: string,
    data: { isSponsored: boolean; sponsorId: string; sponsorUrlId?: string },
  ): Promise<void> {
    await this.studentProfileRepo.update(
      { id: studentProfileId },
      {
        isSponsored: data.isSponsored,
        sponsorId: data.sponsorId,
        sponsorUrlId: data.sponsorUrlId ?? null,
      },
    );
  }

  async recordDailyCheckIn(userId: string): Promise<void> {
    const student = await this.studentProfileRepo.findOne({
      where: { userId },
    });

    if (!student) {
      return; // Not a student, silently ignore
    }

    // TODO: Move to RabbitMQ/Kafka - non-blocking streak update
    await this.analyticsService.updateStudentStreak(student.id);
  }
}
