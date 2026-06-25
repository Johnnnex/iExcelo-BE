import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ExamType } from '../exams/entities/exam-type.entity';
import { Subject } from '../exams/entities/subject.entity';
import { ExamTypeSubject } from '../exams/entities/exam-type-subject.entity';
import { Topic } from '../exams/entities/topic.entity';
import { Passage } from '../exams/entities/passage.entity';
import { Question } from '../exams/entities/question.entity';
import {
  QuestionCategory,
  QuestionDifficulty,
  QuestionType,
} from '../../types';

@Injectable()
export class AdminExamRevisionService {
  constructor(
    @InjectRepository(ExamType)
    private examTypeRepo: Repository<ExamType>,
    @InjectRepository(Subject)
    private subjectRepo: Repository<Subject>,
    @InjectRepository(ExamTypeSubject)
    private examTypeSubjectRepo: Repository<ExamTypeSubject>,
    @InjectRepository(Topic)
    private topicRepo: Repository<Topic>,
    @InjectRepository(Passage)
    private passageRepo: Repository<Passage>,
    @InjectRepository(Question)
    private questionRepo: Repository<Question>,
  ) {}

  // ─── ExamType ──────────────────────────────────────────────────────────────

  async listExamTypes(opts: { page: number; limit: number; search?: string }) {
    const qb = this.examTypeRepo
      .createQueryBuilder('et')
      .loadRelationCountAndMap('et.etsCount', 'et.examTypeSubjects')
      .orderBy('et.name', 'ASC')
      .skip((opts.page - 1) * opts.limit)
      .take(opts.limit);
    if (opts.search) qb.where('et.name ILIKE :s', { s: `%${opts.search}%` });
    const [items, total] = await qb.getManyAndCount();
    return { items, total, page: opts.page, limit: opts.limit };
  }

  async createExamType(dto: {
    name: string;
    description?: string;
    minSubjectsSelectable: number;
    maxSubjectsSelectable: number;
    freeTierQuestionLimit?: number;
    supportedCategories: string[];
  }) {
    const existing = await this.examTypeRepo.findOne({
      where: { name: dto.name },
    });
    if (existing) throw new ConflictException('ExamType name already exists');
    const et = this.examTypeRepo.create({
      ...dto,
      supportedCategories: dto.supportedCategories as QuestionCategory[],
    });
    return this.examTypeRepo.save(et);
  }

  async updateExamType(
    id: string,
    dto: Partial<{
      name: string;
      description: string;
      minSubjectsSelectable: number;
      maxSubjectsSelectable: number;
      freeTierQuestionLimit: number;
      supportedCategories: string[];
      isActive: boolean;
    }>,
  ) {
    const et = await this.examTypeRepo.findOne({ where: { id } });
    if (!et) throw new NotFoundException('ExamType not found');
    if (dto.isActive === false) {
      const etsCount = await this.examTypeSubjectRepo.count({
        where: { examTypeId: id },
      });
      if (etsCount > 0) {
        throw new BadRequestException(
          `Cannot deactivate: ${etsCount} linked subject(s) must be removed first`,
        );
      }
    }
    Object.assign(et, dto);
    return this.examTypeRepo.save(et);
  }

  async deleteExamType(id: string) {
    const et = await this.examTypeRepo.findOne({ where: { id } });
    if (!et) throw new NotFoundException('ExamType not found');
    await this.examTypeRepo.remove(et);
    return { message: 'Deleted' };
  }

  // ─── Subject ───────────────────────────────────────────────────────────────

  async listSubjects(opts: { page: number; limit: number; search?: string }) {
    const qb = this.subjectRepo
      .createQueryBuilder('s')
      .loadRelationCountAndMap('s.etsCount', 's.examTypeSubjects')
      .orderBy('s.name', 'ASC')
      .skip((opts.page - 1) * opts.limit)
      .take(opts.limit);
    if (opts.search) qb.where('s.name ILIKE :s', { s: `%${opts.search}%` });
    const [items, total] = await qb.getManyAndCount();
    return { items, total, page: opts.page, limit: opts.limit };
  }

  async createSubject(dto: {
    name: string;
    description?: string;
    isActive?: boolean;
    isAlsoPractical?: boolean;
  }) {
    const existing = await this.subjectRepo
      .createQueryBuilder('s')
      .where('s.name ILIKE :name', { name: dto.name })
      .getOne();
    if (existing) throw new ConflictException('Subject name already exists');
    return this.subjectRepo.save(
      this.subjectRepo.create({ ...dto, isActive: dto.isActive ?? true }),
    );
  }

  async updateSubject(
    id: string,
    dto: Partial<{
      name: string;
      description: string;
      isActive: boolean;
      isAlsoPractical: boolean;
    }>,
  ) {
    const s = await this.subjectRepo.findOne({ where: { id } });
    if (!s) throw new NotFoundException('Subject not found');
    Object.assign(s, dto);
    return this.subjectRepo.save(s);
  }

  async deleteSubject(id: string) {
    const s = await this.subjectRepo.findOne({ where: { id } });
    if (!s) throw new NotFoundException('Subject not found');
    await this.subjectRepo.remove(s);
    return { message: 'Deleted' };
  }

  // ─── ExamTypeSubject ───────────────────────────────────────────────────────

  listExamTypeSubjects(examTypeId?: string) {
    return this.examTypeSubjectRepo.find({
      where: examTypeId ? { examTypeId } : {},
      relations: ['examType', 'subject'],
      order: { createdAt: 'DESC' },
    });
  }

  async listAllEts(opts: {
    page: number;
    limit: number;
    search?: string;
    examTypeId?: string;
    subjectId?: string;
  }) {
    const qb = this.examTypeSubjectRepo
      .createQueryBuilder('ets')
      .leftJoinAndSelect('ets.examType', 'examType')
      .leftJoinAndSelect('ets.subject', 'subject')
      .loadRelationCountAndMap('ets.questionCount', 'ets.questions')
      .loadRelationCountAndMap('ets.passageCount', 'ets.passages')
      .orderBy('examType.name', 'ASC')
      .addOrderBy('subject.name', 'ASC')
      .skip((opts.page - 1) * opts.limit)
      .take(opts.limit);

    if (opts.examTypeId)
      qb.andWhere('ets.examTypeId = :examTypeId', {
        examTypeId: opts.examTypeId,
      });
    if (opts.subjectId)
      qb.andWhere('ets.subjectId = :subjectId', { subjectId: opts.subjectId });
    if (opts.search)
      qb.andWhere('(examType.name ILIKE :s OR subject.name ILIKE :s)', {
        s: `%${opts.search}%`,
      });

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page: opts.page, limit: opts.limit };
  }

  async linkExamTypeSubject(
    examTypeId: string,
    subjectId: string,
    isCompulsory = false,
  ) {
    const existing = await this.examTypeSubjectRepo.findOne({
      where: { examTypeId, subjectId },
    });
    if (existing) throw new ConflictException('Already linked');
    const link = this.examTypeSubjectRepo.create({
      examTypeId,
      subjectId,
      isCompulsory,
    });
    return this.examTypeSubjectRepo.save(link);
  }

  async updateExamTypeSubject(id: string, data: { isCompulsory: boolean }) {
    const ets = await this.examTypeSubjectRepo.findOne({ where: { id } });
    if (!ets) throw new NotFoundException('Link not found');
    ets.isCompulsory = data.isCompulsory;
    return this.examTypeSubjectRepo.save(ets);
  }

  async unlinkExamTypeSubject(id: string) {
    const link = await this.examTypeSubjectRepo.findOne({ where: { id } });
    if (!link) throw new NotFoundException('Link not found');

    const passageCount = await this.passageRepo
      .createQueryBuilder('p')
      .innerJoin('p.examTypeSubjects', 'ets', 'ets.id = :id', { id })
      .getCount();

    const questionCount = await this.questionRepo
      .createQueryBuilder('q')
      .innerJoin('q.examTypeSubjects', 'ets')
      .where('ets.id = :id', { id })
      .getCount();

    if (questionCount > 0 || passageCount > 0) {
      throw new BadRequestException(
        `Cannot unlink: ${questionCount} question(s) and ${passageCount} passage(s) are assigned here. Remove them first.`,
      );
    }

    await this.examTypeSubjectRepo.remove(link);
    return { message: 'Unlinked' };
  }

  // ─── Topic ─────────────────────────────────────────────────────────────────

  async listTopics(opts: {
    page: number;
    limit: number;
    subjectId?: string;
    search?: string;
  }) {
    const qb = this.topicRepo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.subject', 'subject')
      .orderBy('t.name', 'ASC')
      .skip((opts.page - 1) * opts.limit)
      .take(opts.limit);
    if (opts.subjectId)
      qb.andWhere('t.subjectId = :subjectId', { subjectId: opts.subjectId });
    if (opts.search) qb.andWhere('t.name ILIKE :s', { s: `%${opts.search}%` });
    const [items, total] = await qb.getManyAndCount();
    return { items, total, page: opts.page, limit: opts.limit };
  }

  createTopic(dto: { subjectId: string; name: string; content?: string }) {
    return this.topicRepo.save(this.topicRepo.create(dto));
  }

  async updateTopic(
    id: string,
    dto: Partial<{ name: string; content: string; isActive: boolean }>,
  ) {
    const t = await this.topicRepo.findOne({ where: { id } });
    if (!t) throw new NotFoundException('Topic not found');
    Object.assign(t, dto);
    return this.topicRepo.save(t);
  }

  async deleteTopic(id: string) {
    const t = await this.topicRepo.findOne({ where: { id } });
    if (!t) throw new NotFoundException('Topic not found');
    await this.topicRepo.remove(t);
    return { message: 'Deleted' };
  }

  // ─── Passage ───────────────────────────────────────────────────────────────

  async listPassages(opts: {
    page: number;
    limit: number;
    etsIds?: string[];
    search?: string;
  }) {
    const qb = this.passageRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.examTypeSubjects', 'ets')
      .leftJoinAndSelect('ets.examType', 'et')
      .leftJoinAndSelect('ets.subject', 'subject')
      .orderBy('p.createdAt', 'DESC')
      .skip((opts.page - 1) * opts.limit)
      .take(opts.limit);
    if (opts.etsIds?.length)
      qb.andWhere('ets.id IN (:...etsIds)', { etsIds: opts.etsIds });
    if (opts.search) qb.andWhere('p.title ILIKE :s', { s: `%${opts.search}%` });
    const [items, total] = await qb.getManyAndCount();
    const serialized = items.map((p) => ({
      id: p.id,
      title: p.title,
      content: p.content,
      isActive: p.isActive,
      createdAt: p.createdAt,
      examTypeSubjectIds: (p.examTypeSubjects ?? []).map((e) => e.id),
      examTypeSubjects: (p.examTypeSubjects ?? []).map((e) => ({
        id: e.id,
        examType: e.examType ? { name: e.examType.name } : undefined,
        subject: e.subject ? { name: e.subject.name } : undefined,
      })),
    }));
    return { items: serialized, total, page: opts.page, limit: opts.limit };
  }

  async createPassage(dto: {
    examTypeSubjectIds: string[];
    title: string;
    content: string;
  }) {
    const etsList = await this.examTypeSubjectRepo.find({
      where: { id: In(dto.examTypeSubjectIds) },
    });
    if (etsList.length === 0)
      throw new BadRequestException('At least one valid ETS is required');
    const p = this.passageRepo.create({
      title: dto.title,
      content: dto.content,
      examTypeSubjects: etsList,
    });
    return this.passageRepo.save(p);
  }

  async updatePassage(
    id: string,
    dto: Partial<{
      examTypeSubjectIds: string[];
      title: string;
      content: string;
      isActive: boolean;
    }>,
  ) {
    const p = await this.passageRepo.findOne({
      where: { id },
      relations: ['examTypeSubjects'],
    });
    if (!p) throw new NotFoundException('Passage not found');
    if (dto.title !== undefined) p.title = dto.title;
    if (dto.content !== undefined) p.content = dto.content;
    if (dto.isActive !== undefined) p.isActive = dto.isActive;
    if (dto.examTypeSubjectIds !== undefined) {
      p.examTypeSubjects = await this.examTypeSubjectRepo.find({
        where: { id: In(dto.examTypeSubjectIds) },
      });
    }
    return this.passageRepo.save(p);
  }

  async deletePassage(id: string) {
    const p = await this.passageRepo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Passage not found');
    await this.passageRepo.remove(p);
    return { message: 'Deleted' };
  }

  // ─── Question ──────────────────────────────────────────────────────────────

  async listQuestions(opts: {
    page: number;
    limit: number;
    examTypeSubjectId?: string;
    type?: string;
    category?: string;
    difficulty?: string;
    search?: string;
  }) {
    const qb = this.questionRepo
      .createQueryBuilder('q')
      .leftJoinAndSelect('q.examTypeSubjects', 'ets')
      .leftJoinAndSelect('ets.examType', 'et')
      .leftJoinAndSelect('ets.subject', 's')
      .leftJoinAndSelect('q.topic', 'topic')
      .orderBy('q.createdAt', 'DESC')
      .skip((opts.page - 1) * opts.limit)
      .take(opts.limit);

    if (opts.examTypeSubjectId)
      qb.andWhere(
        `EXISTS (
          SELECT 1 FROM question_exam_type_subjects _qf
          WHERE _qf."questionId" = q.id
          AND _qf."examTypeSubjectId" = :etsId
        )`,
        { etsId: opts.examTypeSubjectId },
      );
    if (opts.type) qb.andWhere('q.type = :type', { type: opts.type });
    if (opts.category)
      qb.andWhere('q.category = :category', { category: opts.category });
    if (opts.difficulty)
      qb.andWhere('q.difficulty = :difficulty', {
        difficulty: opts.difficulty,
      });
    if (opts.search)
      qb.andWhere('q.questionText ILIKE :search', {
        search: `%${opts.search}%`,
      });

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page: opts.page, limit: opts.limit };
  }

  async getQuestion(id: string) {
    const q = await this.questionRepo.findOne({
      where: { id },
      relations: [
        'examTypeSubjects',
        'examTypeSubjects.examType',
        'examTypeSubjects.subject',
        'topic',
        'passage',
      ],
    });
    if (!q) throw new NotFoundException('Question not found');
    return q;
  }

  private async validateQuestionCategory(
    examTypeSubjectIds: string[],
    category: string,
  ) {
    for (const etsId of examTypeSubjectIds) {
      const ets = await this.examTypeSubjectRepo.findOne({
        where: { id: etsId },
        relations: ['examType'],
      });
      if (!ets)
        throw new NotFoundException(
          `Exam type + subject link not found: ${etsId}`,
        );
      const supported = ets.examType?.supportedCategories ?? [];
      if (
        supported.length > 0 &&
        !supported.includes(category as QuestionCategory)
      ) {
        throw new BadRequestException(
          `Category '${category}' is not supported by exam type '${ets.examType.name}'. Supported: ${supported.join(', ')}`,
        );
      }
    }
  }

  async createQuestion(dto: {
    examTypeSubjectIds: string[];
    questionText: string;
    type: string;
    category: string;
    difficulty: string;
    marks?: number;
    options?: Array<{ id: string; text: string; isCorrect: boolean }>;
    correctAnswer?: any;
    explanation?: string;
    topicId?: string;
    passageId?: string;
    validationConfig?: object;
  }) {
    await this.validateQuestionCategory(dto.examTypeSubjectIds, dto.category);
    const etsList = await this.examTypeSubjectRepo.find({
      where: { id: In(dto.examTypeSubjectIds) },
    });
    const { examTypeSubjectIds: _examTypeSubjectIds, ...rest } = dto;
    const q = this.questionRepo.create({
      ...rest,
      type: dto.type as QuestionType,
      category: dto.category as QuestionCategory,
      difficulty: dto.difficulty as QuestionDifficulty,
      examTypeSubjects: etsList,
    });
    return this.questionRepo.save(q);
  }

  async updateQuestion(
    id: string,
    dto: Partial<{
      examTypeSubjectIds: string[];
      questionText: string;
      type: string;
      category: string;
      difficulty: string;
      marks: number;
      options: Array<{ id: string; text: string; isCorrect: boolean }>;
      correctAnswer: any;
      explanation: string;
      topicId: string;
      passageId: string;
      validationConfig: object;
      isActive: boolean;
    }>,
  ) {
    const q = await this.questionRepo.findOne({
      where: { id },
      relations: ['examTypeSubjects', 'examTypeSubjects.examType'],
    });
    if (!q) throw new NotFoundException('Question not found');
    const etsIds =
      dto.examTypeSubjectIds ?? q.examTypeSubjects.map((e) => e.id);
    const category = dto.category ?? q.category;
    await this.validateQuestionCategory(etsIds, category);
    const { examTypeSubjectIds, ...rest } = dto;
    Object.assign(q, rest);
    if (examTypeSubjectIds !== undefined) {
      q.examTypeSubjects = await this.examTypeSubjectRepo.find({
        where: { id: In(examTypeSubjectIds) },
      });
    }
    return this.questionRepo.save(q);
  }

  async deleteQuestion(id: string) {
    const q = await this.questionRepo.findOne({ where: { id } });
    if (!q) throw new NotFoundException('Question not found');
    await this.questionRepo.remove(q);
    return { message: 'Deleted' };
  }

  async bulkImportQuestions(questions: Array<Record<string, unknown>>) {
    const results: { created: number; errors: string[] } = {
      created: 0,
      errors: [],
    };

    for (let i = 0; i < questions.length; i++) {
      try {
        const raw = questions[i];
        const etsIds =
          (raw.examTypeSubjectIds as string[] | undefined) ??
          (raw.examTypeSubjectId ? [raw.examTypeSubjectId as string] : []);
        const etsList = etsIds.length
          ? await this.examTypeSubjectRepo.find({ where: { id: In(etsIds) } })
          : [];
        const q = this.questionRepo.create({
          questionText: raw.questionText as string,
          type: raw.type as QuestionType,
          category: (raw.category ??
            QuestionCategory.OBJECTIVES) as QuestionCategory,
          difficulty: (raw.difficulty ??
            QuestionDifficulty.MEDIUM) as QuestionDifficulty,
          marks: (raw.marks as number) ?? 1,
          options: raw.options as Array<{
            id: string;
            text: string;
            isCorrect: boolean;
          }>,
          correctAnswer: raw.correctAnswer,
          explanation: raw.explanation as string,
          topicId: raw.topicId as string,
          passageId: raw.passageId as string,
          examTypeSubjects: etsList,
        });
        await this.questionRepo.save(q);
        results.created++;
      } catch (err) {
        results.errors.push(`Row ${i + 1}: ${(err as Error).message}`);
      }
    }
    return results;
  }

  getQuestionCsvTemplate(): string {
    const headers = [
      'examTypeSubjectIds',
      'questionText',
      'type',
      'category',
      'difficulty',
      'marks',
      'options',
      'correctAnswer',
      'explanation',
      'topicId',
      'passageId',
    ];
    const exampleRow = [
      'uuid-here',
      'What is the capital of Nigeria?',
      'multiple_choice',
      'objectives',
      'easy',
      '1',
      '[{"id":"opt1","text":"Abuja","isCorrect":true},{"id":"opt2","text":"Lagos","isCorrect":false}]',
      '',
      'Abuja became the capital in 1991.',
      '',
      '',
    ];
    return [headers.join(','), exampleRow.join(',')].join('\n');
  }
}
