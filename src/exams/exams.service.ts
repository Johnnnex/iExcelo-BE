/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  forwardRef,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  ANALYTICS_QUEUE,
  AnalyticsJobs,
} from '../analytics/queue/analytics.queue';
import { EXAM_POST_QUEUE, ExamPostJobs } from './queue/exam-post.queue';
import { In, Repository } from 'typeorm';
import { ExamType } from './entities/exam-type.entity';
import { Subject } from './entities/subject.entity';
import { ExamTypeSubject } from './entities/exam-type-subject.entity';
import { Question } from './entities/question.entity';
import { Passage } from './entities/passage.entity';
import { ExamConfig } from './entities/exam-config.entity';
import { ExamAttempt } from '../students/entities/exam-attempt.entity';
// Entity class references used in TypeORM query-builder joins (not repos — no @InjectRepository)
import { QuestionProgress } from '../students/entities/question-progress.entity';
import { FlaggedQuestion } from '../students/entities/flagged-question.entity';
import { Topic } from './entities/topic.entity';
import { AnalyticsService } from '../analytics/analytics.service';
import { LoggerService } from '../logger/logger.service';
import { GradingService } from './services/grading.service';
import { StudentsService } from '../students/students.service';
import { StartExamDto } from './dto/start-exam.dto';
import { SubmitExamDto } from './dto/submit-exam.dto';
import {
  ExamAttemptStatus,
  ExamConfigModes,
  ExamTypes,
  LogActionTypes,
  LogSeverity,
  QuestionFilter,
  QuestionType,
  SubjectGradeStats,
} from '../../types';

@Injectable()
export class ExamsService {
  constructor(
    @InjectRepository(ExamType)
    private examTypeRepo: Repository<ExamType>,
    @InjectRepository(Subject)
    private subjectRepo: Repository<Subject>,
    @InjectRepository(ExamTypeSubject)
    private examTypeSubjectRepo: Repository<ExamTypeSubject>,
    @InjectRepository(Question)
    private questionRepo: Repository<Question>,
    @InjectRepository(Passage)
    private passageRepo: Repository<Passage>,
    @InjectRepository(ExamConfig)
    private examConfigRepo: Repository<ExamConfig>,
    @InjectRepository(Topic)
    private topicRepo: Repository<Topic>,
    private readonly analyticsService: AnalyticsService,
    @InjectQueue(ANALYTICS_QUEUE) private readonly analyticsQueue: Queue,
    @InjectQueue(EXAM_POST_QUEUE) private readonly examPostQueue: Queue,
    private readonly loggerService: LoggerService,
    private readonly gradingService: GradingService,
    @Inject(forwardRef(() => StudentsService))
    private readonly studentsService: StudentsService,
  ) {}

  // ─── Seeding ─────────────────────────────────────────────────────────────

  // ─── Public Exam Type / Subject Queries ──────────────────────────────────

  async getAllExamTypes() {
    return this.examTypeRepo.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
  }

  async getSubjectsByExamType(examTypeId: string) {
    const etsRecords = await this.examTypeSubjectRepo.find({
      where: { examTypeId },
      relations: ['subject'],
    });

    return etsRecords
      .map((ets) => ets.subject)
      .filter((s) => s?.isActive)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  // ─── Start Exam ───────────────────────────────────────────────────────────

  async startExam(userId: string, dto: StartExamDto) {
    // 1. Resolve student
    const student = await this.studentsService.findByUserId(userId);
    if (!student) throw new NotFoundException('Student profile not found');

    // 2. Access control
    const studentExamType = await this.studentsService.findStudentExamType(
      student.id,
      dto.examTypeId,
    );

    if (!studentExamType?.isPaid && !studentExamType?.isDemoAllowed) {
      throw new ForbiddenException('No access to this exam type');
    }

    // 3. Mock mode requires paid subscription
    if (dto.mode === ExamTypes.MOCK && !studentExamType.isPaid) {
      throw new ForbiddenException('Mock mode requires an active subscription');
    }

    // 3b. Validate category filter
    const supportedCategories =
      studentExamType.examType.supportedCategories ?? [];
    if (dto.category && !supportedCategories.includes(dto.category)) {
      throw new BadRequestException(
        `Category '${dto.category}' is not supported by this exam type. Supported: ${supportedCategories.join(', ')}`,
      );
    }

    // 4. Resolve selectedSubjectIds → ExamTypeSubject records
    const etsRecords = await this.examTypeSubjectRepo.find({
      where: {
        examTypeId: dto.examTypeId,
        subjectId: In(dto.selectedSubjectIds),
      },
    });

    if (etsRecords.length === 0) {
      throw new BadRequestException(
        'No valid subjects found for this exam type',
      );
    }

    // Sort etsRecords to match the exact order subjects were requested.
    // This ensures questions are grouped by subject in the student's chosen order
    // (e.g. English first, then Math, then Chemistry) for all exam modes.
    const subjectOrderMap = new Map(
      dto.selectedSubjectIds.map((id, i) => [id, i]),
    );
    etsRecords.sort(
      (a, b) =>
        (subjectOrderMap.get(a.subjectId) ?? 0) -
        (subjectOrderMap.get(b.subjectId) ?? 0),
    );

    // 5. Fetch questions
    const isPaid = studentExamType.isPaid;
    const freeLimit = studentExamType.examType.freeTierQuestionLimit;

    // For mock mode, fetch the ExamConfig upfront to determine question count and time limit.
    // mock exams never include questionCount in the DTO — server owns that from ExamConfig.
    let mockConfig: ExamConfig | null = null;
    if (dto.mode === ExamTypes.MOCK) {
      mockConfig = await this.examConfigRepo.findOne({
        where: { examTypeId: dto.examTypeId, mode: ExamConfigModes.MOCK },
      });
    }

    // Demo users get at most freeTierQuestionLimit questions;
    // they can ask for fewer (e.g. 20-question revision) and get exactly that.
    // Mock mode: use ExamConfig.standardQuestionCount (never dto.questionCount).
    const effectiveCount = isPaid
      ? (dto.questionCount ?? mockConfig?.standardQuestionCount ?? freeLimit)
      : Math.min(dto.questionCount ?? freeLimit, freeLimit);

    const questions = isPaid
      ? await this.getPaidQuestions(
          etsRecords,
          effectiveCount,
          dto.category,
          dto.questionFilter ?? QuestionFilter.MIXED,
          student.id,
          dto.selectedTopicIds,
        )
      : await this.getFreeTierQuestions(
          etsRecords,
          effectiveCount,
          dto.category,
          dto.selectedTopicIds,
        );

    // 6. Determine time limit
    let timeLimitSeconds: number | null = null;

    if (dto.mode === ExamTypes.MOCK) {
      timeLimitSeconds = (mockConfig?.standardDurationMinutes ?? 95) * 60;
    } else if (dto.mode === ExamTypes.TIMED && dto.timeLimitSeconds) {
      timeLimitSeconds = dto.timeLimitSeconds;
    }

    // 7. Register exam attempt — backend owns startedAt
    // Compute totalMarksPossible from gradable questions only (essays are
    // exempt from scoring — they count as essayCount++ and don't affect %).
    const allQuestionMarks = questions
      .filter((q) => q.type !== (QuestionType.ESSAY as string))
      .reduce((sum, q) => sum + (q.marks ?? 1), 0);
    const examAttempt = await this.studentsService.createExamAttempt({
      studentId: student.id,
      examTypeId: dto.examTypeId,
      mode: dto.mode,
      selectedSubjects: dto.selectedSubjectIds,
      totalQuestions: questions.length,
      totalMarksPossible: allQuestionMarks,
      timeLimitSeconds: timeLimitSeconds ?? undefined,
      status: ExamAttemptStatus.IN_PROGRESS,
      startedAt: new Date(),
      questionResponses: [],
      questionIds: questions.map((q) => q.id),
    });

    // 8. Serialize questions — return first page only (up to PAGE_SIZE)
    const PAGE_SIZE = 100;
    const includeAnswers = dto.mode !== ExamTypes.MOCK;
    const firstPage = questions.slice(0, PAGE_SIZE);
    const serializedQuestions = this.serializeQuestionsForStudent(
      firstPage,
      includeAnswers,
    );

    // 9. Deduplicate passages (only for first page)
    const passageMap = new Map<string, Passage>();
    for (const q of firstPage) {
      if (q.passage && !passageMap.has(q.passage.id)) {
        passageMap.set(q.passage.id, q.passage);
      }
    }

    // 10. Fetch previously flagged question IDs for this student within this set.
    const allQuestionIds = questions.map((q) => q.id);
    const flaggedQuestionIds = await this.studentsService.getFlaggedQuestionIds(
      student.id,
      allQuestionIds,
    );

    // Log exam start (queued — side effect, does not block response)
    await this.examPostQueue.add(ExamPostJobs.LOG_EVENT, {
      userId,
      action: LogActionTypes.EXAM_START,
      description: `Exam started: ${dto.mode}`,
      severity: LogSeverity.INFO,
      metadata: {
        examAttemptId: examAttempt.id,
        mode: dto.mode,
        questionCount: questions.length,
      },
    });

    return {
      examAttemptId: examAttempt.id,
      mode: dto.mode,
      timeLimitSeconds,
      startedAt: examAttempt.startedAt,
      totalCount: questions.length,
      questions: serializedQuestions,
      passages: Array.from(passageMap.values()).map((p) => ({
        id: p.id,
        title: p.title,
        content: p.content,
      })),
      // IDs of questions the student previously flagged — used to pre-seed flag state on the frontend
      flaggedQuestionIds,
    };
  }

  // ─── Submit Exam ──────────────────────────────────────────────────────────

  async submitExam(userId: string, dto: SubmitExamDto) {
    // 1. Resolve student
    const student = await this.studentsService.findByUserId(userId);
    if (!student) throw new NotFoundException('Student profile not found');

    // 2. Resolve exam attempt
    const examAttempt = await this.studentsService.findExamAttemptById(
      dto.examAttemptId,
      student.id,
    );
    if (!examAttempt) throw new NotFoundException('Exam attempt not found');
    if (examAttempt.status === ExamAttemptStatus.COMPLETED) {
      throw new BadRequestException('This exam has already been submitted');
    }

    // 3. Time validation — backend owns the clock
    const elapsedSeconds = Math.floor(
      (Date.now() - examAttempt.startedAt.getTime()) / 1000,
    );
    const GRACE_BUFFER = 120; // 2-minute network/latency allowance
    if (
      examAttempt.timeLimitSeconds &&
      elapsedSeconds > examAttempt.timeLimitSeconds + GRACE_BUFFER
    ) {
      throw new BadRequestException(
        'Submission rejected: time limit exceeded. Your answers were not saved.',
      );
    }
    const finalStatus =
      examAttempt.timeLimitSeconds &&
      elapsedSeconds > examAttempt.timeLimitSeconds
        ? ExamAttemptStatus.AUTO_SUBMITTED
        : ExamAttemptStatus.COMPLETED;

    // 4. Fetch questions with examTypeSubject relation (for analytics subjectId)
    const questionIds = dto.questionResponses.map((r) => r.questionId);
    const questions = await this.questionRepo.find({
      where: { id: In(questionIds) },
      relations: ['examTypeSubject'],
    });
    const questionMap = new Map(questions.map((q) => [q.id, q]));

    // 5. Grade each response
    let correctAnswers = 0;
    let wrongAnswers = 0;
    let totalMarksObtained = 0;
    let essayCount = 0;
    const gradedResponses: ExamAttempt['questionResponses'] = [];
    const subjectStats = new Map<string, SubjectGradeStats>();
    // Accumulate per-question data for the background batch job (no async calls in this loop)
    const questionBatchResults: Array<{
      questionId: string;
      isCorrect: boolean | null;
      exemptFromMetrics: boolean;
      isFlagged: boolean;
      flagType?: string;
      flagReason?: string;
    }> = [];

    for (const response of dto.questionResponses) {
      const question = questionMap.get(response.questionId);
      if (!question) continue;

      // Skip truly empty answers — count as unanswered, not wrong
      const isEmpty =
        response.answer == null ||
        (typeof response.answer === 'string' &&
          response.answer.trim() === '') ||
        (Array.isArray(response.answer) && response.answer.length === 0);
      if (isEmpty) continue;

      const subjectId = question.examTypeSubject?.subjectId;
      const result = this.gradingService.gradeQuestion(
        question,
        response.answer,
      );
      if (subjectId && !subjectStats.has(subjectId)) {
        subjectStats.set(subjectId, {
          questionsAttempted: 0,
          questionsCorrect: 0,
          questionsWrong: 0,
          essayQuestionsAttempted: 0,
        });
      }
      const stats = subjectId ? subjectStats.get(subjectId)! : null;

      if (result.exemptFromMetrics) {
        essayCount++;
        if (stats) stats.essayQuestionsAttempted++;
      } else {
        totalMarksObtained += result.marksAwarded;
        if (stats) stats.questionsAttempted++;
        if (result.isCorrect) {
          correctAnswers++;
          if (stats) stats.questionsCorrect++;
        } else {
          wrongAnswers++;
          if (stats) stats.questionsWrong++;
        }
      }

      gradedResponses.push({
        questionId: response.questionId,
        answer: response.answer,
        isCorrect: result.isCorrect,
        marksAwarded: result.marksAwarded,
        timeSpent: response.timeSpent,
        feedback: result.feedback,
        exemptFromMetrics: result.exemptFromMetrics ?? false,
        isFlagged: response.isFlagged ?? false,
        flagType: response.flagType ?? undefined,
      });

      // Accumulate for background job (no blocking I/O inside this loop)
      questionBatchResults.push({
        questionId: question.id,
        isCorrect: result.isCorrect,
        exemptFromMetrics: result.exemptFromMetrics ?? false,
        isFlagged: response.isFlagged ?? false,
        flagType: response.flagType,
        flagReason: response.flagReason,
      });
    }

    const totalAttempted = correctAnswers + wrongAnswers;
    // Unanswered = total questions minus ALL non-empty responses submitted
    const unanswered =
      examAttempt.totalQuestions - dto.questionResponses.length;
    // Use marks of ALL questions (stored at start time) so unanswered = 0 marks
    const scorePercentage =
      examAttempt.totalMarksPossible > 0
        ? (totalMarksObtained / examAttempt.totalMarksPossible) * 100
        : 0;

    // 6. Persist exam attempt result (synchronous — student needs this immediately)
    examAttempt.correctAnswers = correctAnswers;
    examAttempt.wrongAnswers = wrongAnswers;
    examAttempt.unanswered = unanswered;
    examAttempt.scorePercentage = scorePercentage;
    examAttempt.totalMarksObtained = totalMarksObtained;
    // totalMarksPossible already set at start time — do not overwrite
    examAttempt.questionResponses = gradedResponses;
    examAttempt.timeSpentSeconds = elapsedSeconds;
    examAttempt.status = finalStatus;
    examAttempt.completedAt = new Date();
    await this.studentsService.saveExamAttempt(examAttempt);

    // 7–8. Dispatch all post-submission side effects to background queues
    // Student gets their result immediately — these run asynchronously with retries

    await this.examPostQueue.add(ExamPostJobs.QUESTION_BATCH, {
      studentId: student.id,
      questionResults: questionBatchResults,
      flagUpdates: dto.flagUpdates,
    });

    await this.examPostQueue.add(ExamPostJobs.LIFETIME_METRICS, {
      studentId: student.id,
      totalAttempted,
      correctAnswers,
      wrongAnswers,
    });

    await this.analyticsQueue.add(AnalyticsJobs.UPDATE_DAILY, {
      studentId: student.id,
      examTypeId: examAttempt.examTypeId,
      data: {
        questionsAttempted: totalAttempted,
        questionsCorrect: correctAnswers,
        questionsWrong: wrongAnswers,
        questionsUnanswered: unanswered,
        timeSpentSeconds: elapsedSeconds,
        scorePercentage,
      },
    });

    if (subjectStats.size > 0) {
      await this.analyticsQueue.add(AnalyticsJobs.UPDATE_SUBJECT_BATCH, {
        studentId: student.id,
        examTypeId: examAttempt.examTypeId,
        subjects: Array.from(subjectStats.entries()).map(
          ([subjectId, stats]) => ({ subjectId, data: stats }),
        ),
      });
    }

    await this.examPostQueue.add(ExamPostJobs.LOG_EVENT, {
      userId,
      action: LogActionTypes.EXAM_SUBMIT,
      description: `Exam submitted: ${examAttempt.mode}`,
      severity: LogSeverity.INFO,
      metadata: {
        examAttemptId: examAttempt.id,
        score: scorePercentage,
        correctAnswers,
        wrongAnswers,
        essayCount,
        status: finalStatus,
      },
    });

    return {
      examAttemptId: examAttempt.id,
      status: finalStatus,
      correctAnswers,
      wrongAnswers,
      unanswered,
      essayQuestions: essayCount,
      scorePercentage,
      totalMarksObtained,
      totalMarksPossible: examAttempt.totalMarksPossible,
      timeSpentSeconds: elapsedSeconds,
      detailedResults: gradedResponses,
    };
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  /**
   * Free tier: same deterministic set every time per ExamTypeSubject.
   * Distributes remainder so the actual total matches the requested totalLimit.
   */
  private async getFreeTierQuestions(
    etsRecords: ExamTypeSubject[],
    totalLimit: number,
    category?: string,
    selectedTopicIds?: string[],
  ): Promise<Question[]> {
    const n = etsRecords.length;
    const basePerETS = Math.floor(totalLimit / n);
    const remainder = totalLimit - basePerETS * n;

    const all = await Promise.all(
      etsRecords.map(async (ets, idx) => {
        const quota = basePerETS + (idx < remainder ? 1 : 0);
        if (quota === 0) return [];
        // Topic-priority: if selectedTopicIds given, fetch topic-tagged first
        if (selectedTopicIds && selectedTopicIds.length > 0) {
          return this.fetchWithTopicPriority(
            ets.id,
            quota,
            category,
            undefined,
            selectedTopicIds,
          );
        }
        return this.questionRepo.find({
          where: {
            examTypeSubjectId: ets.id,
            isActive: true,
            ...(category ? { category } : {}),
          },
          relations: ['passage', 'topic'],
          order: { createdAt: 'ASC' },
          take: quota,
        });
      }),
    );

    return all.flat();
  }

  /**
   * Paid tier question selection.
   * Distributes the requested total across subjects in the same order as
   * etsRecords (which is already sorted to match selectedSubjectIds order).
   * Each subject fetches its own quota independently, then results are
   * concatenated — so the final array is grouped by subject in request order.
   *
   * Distribution: floor(total/n) per subject; first `remainder` subjects get +1.
   * The last subject takes the smallest slice when total doesn't divide evenly.
   *
   * If selectedTopicIds is provided, topic-tagged questions are prioritised
   * first for each subject; the remainder falls back to the normal filter strategy.
   */
  private async getPaidQuestions(
    etsRecords: ExamTypeSubject[],
    total: number,
    category?: string,
    filter: QuestionFilter = QuestionFilter.MIXED,
    studentId?: string,
    selectedTopicIds?: string[],
  ): Promise<Question[]> {
    const n = etsRecords.length;
    const basePerSubject = Math.floor(total / n);
    const remainder = total - basePerSubject * n;

    const perSubject = await Promise.all(
      etsRecords.map(async (ets, idx) => {
        const quota = basePerSubject + (idx < remainder ? 1 : 0);
        if (quota === 0) return [];

        if (selectedTopicIds && selectedTopicIds.length > 0) {
          return this.fetchWithTopicPriority(
            ets.id,
            quota,
            category,
            studentId,
            selectedTopicIds,
          );
        }

        const etsIds = [ets.id];
        switch (filter) {
          case QuestionFilter.FRESH:
            return this.getFreshQuestions(etsIds, quota, category, studentId);
          case QuestionFilter.FLAGGED:
            return this.getFlaggedQuestions(etsIds, quota, category, studentId);
          case QuestionFilter.WEAK:
            return this.getWeakQuestions(etsIds, quota, category, studentId);
          case QuestionFilter.MIXED:
          default:
            return this.getMixedQuestions(etsIds, quota, category, studentId);
        }
      }),
    );

    return perSubject.flat();
  }

  /**
   * Fetches questions prioritising those tagged with selectedTopicIds.
   * Step 1: fetch up to `quota` questions with topicId IN selectedTopicIds.
   * Step 2: if fewer than quota, fill remainder from any questions for this
   *         subject (excluding already-fetched IDs) so the quota is always met.
   */
  private async fetchWithTopicPriority(
    etsId: string,
    quota: number,
    category: string | undefined,
    _studentId: string | undefined,
    topicIds: string[],
  ): Promise<Question[]> {
    const topicQb = this.questionRepo
      .createQueryBuilder('q')
      .leftJoinAndSelect('q.passage', 'passage')
      .leftJoinAndSelect('q.topic', 'topic')
      .where('q.examTypeSubjectId = :etsId', { etsId })
      .andWhere('q.isActive = true')
      .andWhere('q.topicId IN (:...topicIds)', { topicIds })
      .orderBy('RANDOM()')
      .limit(quota);
    if (category) topicQb.andWhere('q.category = :category', { category });

    const topicQuestions = await topicQb.getMany();
    if (topicQuestions.length >= quota) return topicQuestions;

    const remaining = quota - topicQuestions.length;
    const usedIds = topicQuestions.map((q) => q.id);

    const fillQb = this.questionRepo
      .createQueryBuilder('q')
      .leftJoinAndSelect('q.passage', 'passage')
      .leftJoinAndSelect('q.topic', 'topic')
      .where('q.examTypeSubjectId = :etsId', { etsId })
      .andWhere('q.isActive = true')
      .orderBy('RANDOM()')
      .limit(remaining);
    if (category) fillQb.andWhere('q.category = :category', { category });
    if (usedIds.length > 0)
      fillQb.andWhere('q.id NOT IN (:...usedIds)', { usedIds });

    const fill = await fillQb.getMany();
    return [...topicQuestions, ...fill];
  }

  /**
   * FRESH: unseen questions only (no QuestionProgress row or timesAttempted = 0).
   * Falls back to seen (worst first) if the unseen pool is exhausted.
   */
  private async getFreshQuestions(
    etsIds: string[],
    total: number,
    category?: string,
    studentId?: string,
  ): Promise<Question[]> {
    const unseenQb = this.questionRepo
      .createQueryBuilder('q')
      .leftJoinAndSelect('q.passage', 'passage')
      .leftJoinAndSelect('q.topic', 'topic')
      .leftJoin(
        QuestionProgress,
        'qp',
        'qp.questionId = q.id AND qp.studentId = :studentId',
        { studentId: studentId ?? '' },
      )
      .where('q.examTypeSubjectId IN (:...etsIds)', { etsIds })
      .andWhere('q.isActive = true')
      .andWhere('(qp.id IS NULL OR qp.timesAttempted = 0)')
      .orderBy('RANDOM()')
      .limit(total);

    if (category) unseenQb.andWhere('q.category = :category', { category });

    const unseen = await unseenQb.getMany();
    if (unseen.length >= total) return unseen;

    // Fallback: fill remaining slots with seen questions (worst first)
    const remaining = total - unseen.length;
    const unseenIds = unseen.map((q) => q.id);

    const seenQb = this.questionRepo
      .createQueryBuilder('q')
      .leftJoinAndSelect('q.passage', 'passage')
      .leftJoinAndSelect('q.topic', 'topic')
      .innerJoin(
        QuestionProgress,
        'qp',
        'qp.questionId = q.id AND qp.studentId = :studentId',
        { studentId: studentId ?? '' },
      )
      .where('q.examTypeSubjectId IN (:...etsIds)', { etsIds })
      .andWhere('q.isActive = true')
      .andWhere('qp.timesAttempted > 0')
      .orderBy('qp.timesWrong', 'DESC')
      .addOrderBy('qp.timesCorrect', 'ASC')
      .limit(remaining);

    if (unseenIds.length > 0)
      seenQb.andWhere('q.id NOT IN (:...unseenIds)', { unseenIds });
    if (category) seenQb.andWhere('q.category = :category', { category });

    const seen = await seenQb.getMany();
    return [...unseen, ...seen];
  }

  /**
   * FLAGGED: flagged questions first (most-recently-flagged), then fills remaining
   * slots with unseen questions so the session is always full-sized.
   */
  private async getFlaggedQuestions(
    etsIds: string[],
    total: number,
    category?: string,
    studentId?: string,
  ): Promise<Question[]> {
    const flaggedQb = this.questionRepo
      .createQueryBuilder('q')
      .leftJoinAndSelect('q.passage', 'passage')
      .leftJoinAndSelect('q.topic', 'topic')
      .innerJoin(
        FlaggedQuestion,
        'fq',
        'fq.questionId = q.id AND fq.studentId = :studentId',
        { studentId: studentId ?? '' },
      )
      .where('q.examTypeSubjectId IN (:...etsIds)', { etsIds })
      .andWhere('q.isActive = true')
      .orderBy('fq.flaggedAt', 'DESC')
      .limit(total);

    if (category) flaggedQb.andWhere('q.category = :category', { category });

    const flagged = await flaggedQb.getMany();
    if (flagged.length >= total) return flagged;

    // Fill remaining slots with unseen questions
    const remaining = total - flagged.length;
    const flaggedIds = flagged.map((q) => q.id);

    const fillQb = this.questionRepo
      .createQueryBuilder('q')
      .leftJoinAndSelect('q.passage', 'passage')
      .leftJoinAndSelect('q.topic', 'topic')
      .leftJoin(
        QuestionProgress,
        'qp',
        'qp.questionId = q.id AND qp.studentId = :studentId',
        { studentId: studentId ?? '' },
      )
      .where('q.examTypeSubjectId IN (:...etsIds)', { etsIds })
      .andWhere('q.isActive = true')
      .andWhere('(qp.id IS NULL OR qp.timesAttempted = 0)')
      .andWhere('q.id NOT IN (:...flaggedIds)', { flaggedIds })
      .orderBy('RANDOM()')
      .limit(remaining);

    if (category) fillQb.andWhere('q.category = :category', { category });

    const fill = await fillQb.getMany();
    return [...flagged, ...fill];
  }

  /**
   * WEAK: questions with poor accuracy (timesWrong > timesCorrect OR ≥2 wrong).
   * Sorted by most wrong first.
   */
  private async getWeakQuestions(
    etsIds: string[],
    total: number,
    category?: string,
    studentId?: string,
  ): Promise<Question[]> {
    const qb = this.questionRepo
      .createQueryBuilder('q')
      .leftJoinAndSelect('q.passage', 'passage')
      .leftJoinAndSelect('q.topic', 'topic')
      .innerJoin(
        QuestionProgress,
        'qp',
        'qp.questionId = q.id AND qp.studentId = :studentId',
        { studentId: studentId ?? '' },
      )
      .where('q.examTypeSubjectId IN (:...etsIds)', { etsIds })
      .andWhere('q.isActive = true')
      .andWhere('qp.timesAttempted > 0')
      .andWhere('(qp.timesWrong > qp.timesCorrect OR qp.timesWrong >= 2)')
      .orderBy('qp.timesWrong', 'DESC')
      .addOrderBy('qp.timesCorrect', 'ASC')
      .addOrderBy('qp.lastAttempted', 'ASC')
      .limit(total);

    if (category) qb.andWhere('q.category = :category', { category });

    const weak = await qb.getMany();
    if (weak.length >= total) return weak;

    // Fill remaining slots with mixed questions (excluding already-fetched weak ones)
    const remaining = total - weak.length;
    const weakIds = weak.map((q) => q.id);
    const fill = await this.getMixedQuestions(
      etsIds,
      remaining,
      category,
      studentId,
      weakIds,
    );
    return [...weak, ...fill];
  }

  /**
   * MIXED: ~90% unseen (random) + ~10% seen (worst first), interleaved.
   * Seen questions are inserted at every 20th position so the student
   * encounters familiar-but-hard questions at regular intervals.
   * Falls back gracefully when unseen pool is exhausted.
   */
  private async getMixedQuestions(
    etsIds: string[],
    total: number,
    category?: string,
    studentId?: string,
    excludeIds: string[] = [],
  ): Promise<Question[]> {
    // Calculate slots: 2 seen per 20 questions (10%)
    const seenSlots = Math.floor(total / 20) * 2;
    const unseenSlots = total - seenSlots;

    const unseenQb = this.questionRepo
      .createQueryBuilder('q')
      .leftJoinAndSelect('q.passage', 'passage')
      .leftJoinAndSelect('q.topic', 'topic')
      .leftJoin(
        QuestionProgress,
        'qp',
        'qp.questionId = q.id AND qp.studentId = :studentId',
        { studentId: studentId ?? '' },
      )
      .where('q.examTypeSubjectId IN (:...etsIds)', { etsIds })
      .andWhere('q.isActive = true')
      .andWhere('(qp.id IS NULL OR qp.timesAttempted = 0)')
      .orderBy('RANDOM()')
      .limit(unseenSlots);

    if (excludeIds.length > 0)
      unseenQb.andWhere('q.id NOT IN (:...excludeIds)', { excludeIds });
    if (category) unseenQb.andWhere('q.category = :category', { category });

    const unseen = await unseenQb.getMany();

    // No seen slots needed (small session) → just return unseen with fallback
    if (seenSlots === 0) {
      if (unseen.length >= total) return unseen;
      const remaining = total - unseen.length;
      const usedIds = [...unseen.map((q) => q.id), ...excludeIds];
      const fallbackQb = this.questionRepo
        .createQueryBuilder('q')
        .leftJoinAndSelect('q.passage', 'passage')
        .leftJoinAndSelect('q.topic', 'topic')
        .where('q.examTypeSubjectId IN (:...etsIds)', { etsIds })
        .andWhere('q.isActive = true')
        .orderBy('RANDOM()')
        .limit(remaining);
      if (usedIds.length > 0)
        fallbackQb.andWhere('q.id NOT IN (:...usedIds)', { usedIds });
      if (category) fallbackQb.andWhere('q.category = :category', { category });
      const fallback = await fallbackQb.getMany();
      return [...unseen, ...fallback];
    }

    // Absorb shortfall into seen slots if unseen pool is small
    const actualSeenSlots =
      seenSlots + Math.max(0, unseenSlots - unseen.length);
    const usedIds = [...unseen.map((q) => q.id), ...excludeIds];

    const seenQb = this.questionRepo
      .createQueryBuilder('q')
      .leftJoinAndSelect('q.passage', 'passage')
      .leftJoinAndSelect('q.topic', 'topic')
      .innerJoin(
        QuestionProgress,
        'qp',
        'qp.questionId = q.id AND qp.studentId = :studentId',
        { studentId: studentId ?? '' },
      )
      .where('q.examTypeSubjectId IN (:...etsIds)', { etsIds })
      .andWhere('q.isActive = true')
      .andWhere('qp.timesAttempted > 0')
      .orderBy('qp.timesWrong', 'DESC')
      .addOrderBy('qp.timesCorrect', 'ASC')
      .addOrderBy('qp.lastAttempted', 'ASC')
      .limit(actualSeenSlots);

    if (usedIds.length > 0)
      seenQb.andWhere('q.id NOT IN (:...usedIds)', { usedIds });
    if (category) seenQb.andWhere('q.category = :category', { category });

    const seen = await seenQb.getMany();

    return this.interleaveQuestions(unseen, seen);
  }

  /**
   * Interleaves seen questions into the unseen array at every 20th position.
   * e.g. positions 1-19 → unseen, position 20 → seen (worst), 21-39 → unseen, etc.
   */
  private interleaveQuestions(
    unseen: Question[],
    seen: Question[],
  ): Question[] {
    if (seen.length === 0) return unseen;
    const result: Question[] = [];
    let unseenIdx = 0;
    let seenIdx = 0;
    let pos = 0;

    while (unseenIdx < unseen.length || seenIdx < seen.length) {
      pos++;
      if (pos % 20 === 0 && seenIdx < seen.length) {
        result.push(seen[seenIdx++]);
      } else if (unseenIdx < unseen.length) {
        result.push(unseen[unseenIdx++]);
      } else {
        result.push(seen[seenIdx++]);
      }
    }

    return result;
  }

  /**
   * Serializes questions for the student response.
   * - isCorrect always stripped from options
   * - correctAnswer + explanations included for revision/timed (not mock)
   */
  private serializeQuestionsForStudent(
    questions: Question[],
    includeAnswers: boolean,
  ) {
    return questions.map((q) => ({
      id: q.id,
      questionText: q.questionText,
      type: q.type,
      marks: q.marks,
      difficulty: q.difficulty,
      passageId: q.passageId ?? null,
      options: q.options?.map((opt) => ({ id: opt.id, text: opt.text })) ?? [],
      ...(includeAnswers && {
        correctAnswer: q.correctAnswer,
        topicId: q.topicId ?? null,
        topicName: q.topic?.name ?? null,
        explanationShort: q.explanationShort ?? null,
        explanationLong: q.explanationLong ?? null,
      }),
    }));
  }

  // ─── Paginated Questions ───────────────────────────────────────────────────

  /**
   * Returns a page of questions for an in-progress exam attempt.
   * The question order is fixed by examAttempt.questionIds (set at startExam).
   */
  async getAttemptQuestions(
    userId: string,
    attemptId: string,
    offset: number,
    limit: number,
  ) {
    const student = await this.studentsService.findByUserId(userId);
    if (!student) throw new NotFoundException('Student profile not found');

    const attempt = await this.studentsService.findExamAttemptById(
      attemptId,
      student.id,
    );
    if (!attempt) throw new NotFoundException('Exam attempt not found');

    const allIds: string[] = Array.isArray(attempt.questionIds)
      ? attempt.questionIds
      : [];

    if (allIds.length === 0) {
      return { questions: [], passages: [], total: 0 };
    }

    const pageIds: string[] = allIds.slice(offset, offset + limit);
    if (pageIds.length === 0) {
      return { questions: [], passages: [], total: allIds.length };
    }

    const questions = await this.questionRepo.find({
      where: { id: In(pageIds) },
      relations: ['passage', 'topic'],
    });

    // Restore the original order from questionIds
    const qMap = new Map<string, Question>(questions.map((q) => [q.id, q]));
    const ordered: Question[] = pageIds
      .map((id) => qMap.get(id))
      .filter((q): q is Question => q !== undefined);

    const includeAnswers = attempt.mode !== ExamTypes.MOCK;
    const serialized = this.serializeQuestionsForStudent(
      ordered,
      includeAnswers,
    );

    const passageMap = new Map<string, Passage>();
    for (const q of ordered) {
      if (q.passage && !passageMap.has(q.passage.id)) {
        passageMap.set(q.passage.id, q.passage);
      }
    }

    return {
      questions: serialized,
      passages: Array.from(passageMap.values()).map((p) => ({
        id: p.id,
        title: p.title,
        content: p.content,
      })),
      total: allIds.length,
    };
  }

  // ─── Draft Responses ───────────────────────────────────────────────────────

  /**
   * Saves draft question responses to the attempt for refresh recovery.
   * Does NOT grade — only persists the student's in-progress answers.
   */
  async saveDraft(
    userId: string,
    attemptId: string,
    draftResponses: Record<string, unknown>,
  ) {
    const student = await this.studentsService.findByUserId(userId);
    if (!student) throw new NotFoundException('Student profile not found');

    const attempt = await this.studentsService.findExamAttemptById(
      attemptId,
      student.id,
    );
    if (!attempt) throw new NotFoundException('Exam attempt not found');
    if (attempt.status !== ExamAttemptStatus.IN_PROGRESS) {
      throw new BadRequestException('Exam is not in progress');
    }

    attempt.draftResponses = draftResponses;
    await this.studentsService.saveExamAttempt(attempt);
    return { saved: true };
  }

  /**
   * Retrieves draft responses and metadata so the frontend can resume after a page reload.
   */
  async getDraft(userId: string, attemptId: string) {
    const student = await this.studentsService.findByUserId(userId);
    if (!student) throw new NotFoundException('Student profile not found');

    const attempt = await this.studentsService.findExamAttemptById(
      attemptId,
      student.id,
    );
    if (!attempt) throw new NotFoundException('Exam attempt not found');

    const totalCount: number = Array.isArray(attempt.questionIds)
      ? attempt.questionIds.length
      : attempt.totalQuestions;

    return {
      examAttemptId: attempt.id,
      mode: attempt.mode,
      timeLimitSeconds: attempt.timeLimitSeconds ?? null,
      startedAt: attempt.startedAt,
      totalCount,
      status: attempt.status,
      draftResponses: attempt.draftResponses ?? {},
    };
  }

  // ─── Topics API ───────────────────────────────────────────────────────────

  /**
   * Returns active topics for a subject.
   * When page+limit are provided, returns paginated { topics, total, hasMore }.
   * Without page/limit, returns a flat array (used by the Exams page accordion).
   */
  async getTopicsForSubject(subjectId: string, page?: number, limit?: number) {
    if (page !== undefined && limit !== undefined) {
      const [topics, total] = await this.topicRepo.findAndCount({
        where: { subjectId, isActive: true },
        order: { name: 'ASC' },
        skip: (page - 1) * limit,
        take: limit,
      });
      return { topics, total, hasMore: page * limit < total };
    }
    return this.topicRepo.find({
      where: { subjectId, isActive: true },
      order: { name: 'ASC' },
    });
  }

  /**
   * Searches topics by name (and content if query is long enough).
   * Scoped to all subjects that belong to the given examTypeId.
   * Used on the /student/topics page search.
   */
  async searchTopics(examTypeId: string, q: string) {
    const qb = this.topicRepo
      .createQueryBuilder('t')
      .innerJoin(
        'exam_type_subjects',
        'ets',
        'ets.subjectId = t.subjectId AND ets.examTypeId = :examTypeId',
        { examTypeId },
      )
      .where('t.isActive = true');

    if (q) {
      qb.andWhere('(LOWER(t.name) LIKE :q OR LOWER(t.content) LIKE :q)', {
        q: `%${q.toLowerCase()}%`,
      });
    }

    return qb.orderBy('t.name', 'ASC').getMany();
  }

  /**
   * Returns subjects with their first `limit` topics and total count per subject.
   * For the /student/topics page — initial load fetches total + first page in one call.
   */
  async getTopicsByExamType(
    examTypeId: string,
    subjectIds?: string[],
    limit = 20,
  ) {
    const etsRecords = await this.examTypeSubjectRepo.find({
      where: {
        examTypeId,
        ...(subjectIds && subjectIds.length > 0
          ? { subjectId: In(subjectIds) }
          : {}),
      },
      relations: ['subject'],
    });

    const activeEts = etsRecords.filter((ets) => ets.subject?.isActive);

    return Promise.all(
      activeEts.map(async (ets) => {
        const [topics, total] = await this.topicRepo.findAndCount({
          where: { subjectId: ets.subjectId, isActive: true },
          order: { name: 'ASC' },
          take: limit,
        });
        return {
          subjectId: ets.subjectId,
          subjectName: ets.subject.name,
          topics,
          total,
          hasMore: total > limit,
        };
      }),
    );
  }

  /**
   * Returns a single topic by ID — used on the /student/topics/:id detail page.
   */
  async getTopic(topicId: string) {
    const topic = await this.topicRepo.findOne({
      where: { id: topicId, isActive: true },
      relations: ['subject'],
    });
    if (!topic) throw new NotFoundException('Topic not found');
    return topic;
  }

  // ─── Mock Config ──────────────────────────────────────────────────────────

  async getMockConfig(examTypeId: string) {
    const config = await this.examConfigRepo.findOne({
      where: { examTypeId, mode: ExamConfigModes.MOCK },
    });
    return {
      standardDurationMinutes: config?.standardDurationMinutes ?? 95,
      standardQuestionCount: config?.standardQuestionCount ?? 60,
    };
  }

  // ─── Admin: Diagnose ──────────────────────────────────────────────────────

  /**
   * Diagnostic: shows ETS records, question counts per ETS, and orphaned questions.
   * Orphaned = questions whose examTypeSubjectId doesn't match any current ETS record.
   * Call GET /exams/admin/diagnose-questions to debug "questions: []" issues.
   */
  async diagnoseQuestions() {
    const allETS = await this.examTypeSubjectRepo.find({
      relations: ['examType', 'subject'],
    });

    const etsIds = allETS.map((e) => e.id);

    const perETS = await Promise.all(
      allETS.map(async (ets) => ({
        etsId: ets.id,
        examType: ets.examType?.name ?? '?',
        subject: ets.subject?.name ?? '?',
        questionCount: await this.questionRepo.count({
          where: { examTypeSubjectId: ets.id },
        }),
        activeQuestionCount: await this.questionRepo.count({
          where: { examTypeSubjectId: ets.id, isActive: true },
        }),
      })),
    );

    const orphanedCount =
      etsIds.length > 0
        ? await this.questionRepo
            .createQueryBuilder('q')
            .where('q.examTypeSubjectId NOT IN (:...etsIds)', { etsIds })
            .getCount()
        : await this.questionRepo.count();

    return { ets: perETS, orphanedQuestions: orphanedCount };
  }

  // ─── Methods used by StudentsService (cross-resource delegation) ─────────

  /** Find an ExamType by ID. */
  async findExamTypeById(id: string): Promise<ExamType | null> {
    return this.examTypeRepo.findOne({ where: { id } });
  }

  /** Find subjects by IDs with their examTypeSubjects relation loaded. */
  async findSubjectsWithExamTypes(subjectIds: string[]): Promise<Subject[]> {
    if (subjectIds.length === 0) return [];
    return this.subjectRepo.find({
      where: { id: In(subjectIds) },
      relations: ['examTypeSubjects'],
    });
  }

  /** Find subjects by IDs, returning only id and name. */
  async findSubjectsByIds(
    subjectIds: string[],
  ): Promise<{ id: string; name: string }[]> {
    if (subjectIds.length === 0) return [];
    const subjects = await this.subjectRepo.find({
      where: { id: In(subjectIds) },
      select: ['id', 'name'],
    });
    return subjects.map((s) => ({ id: s.id, name: s.name }));
  }

  /** Find questions by IDs with their passage and topic relations loaded, in original order. */
  async findQuestionsWithPassages(questionIds: string[]): Promise<Question[]> {
    if (questionIds.length === 0) return [];
    return this.questionRepo.find({
      where: { id: In(questionIds) },
      relations: ['passage', 'topic'],
    });
  }
}
