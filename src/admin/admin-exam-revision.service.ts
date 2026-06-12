import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
      .orderBy('et.name', 'ASC')
      .skip((opts.page - 1) * opts.limit)
      .take(opts.limit);
    if (opts.search)
      qb.where('et.name ILIKE :s', { s: `%${opts.search}%` });
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
      .orderBy('s.name', 'ASC')
      .skip((opts.page - 1) * opts.limit)
      .take(opts.limit);
    if (opts.search)
      qb.where('s.name ILIKE :s', { s: `%${opts.search}%` });
    const [items, total] = await qb.getManyAndCount();
    return { items, total, page: opts.page, limit: opts.limit };
  }

  async createSubject(dto: { name: string; description?: string }) {
    const existing = await this.subjectRepo
      .createQueryBuilder('s')
      .where('s.name ILIKE :name', { name: dto.name })
      .getOne();
    if (existing) throw new ConflictException('Subject name already exists');
    return this.subjectRepo.save(this.subjectRepo.create(dto));
  }

  async updateSubject(
    id: string,
    dto: Partial<{ name: string; description: string; isActive: boolean }>,
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

  async unlinkExamTypeSubject(id: string) {
    const link = await this.examTypeSubjectRepo.findOne({ where: { id } });
    if (!link) throw new NotFoundException('Link not found');
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
    if (opts.search)
      qb.andWhere('t.name ILIKE :s', { s: `%${opts.search}%` });
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
    examTypeSubjectId?: string;
    search?: string;
  }) {
    const qb = this.passageRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.examTypeSubject', 'ets')
      .leftJoinAndSelect('ets.examType', 'et')
      .leftJoinAndSelect('ets.subject', 'subject')
      .orderBy('p.createdAt', 'DESC')
      .skip((opts.page - 1) * opts.limit)
      .take(opts.limit);
    if (opts.examTypeSubjectId)
      qb.andWhere('p.examTypeSubjectId = :etsId', {
        etsId: opts.examTypeSubjectId,
      });
    if (opts.search)
      qb.andWhere('p.title ILIKE :s', { s: `%${opts.search}%` });
    const [items, total] = await qb.getManyAndCount();
    return { items, total, page: opts.page, limit: opts.limit };
  }

  createPassage(dto: {
    examTypeSubjectId: string;
    title: string;
    content: string;
  }) {
    return this.passageRepo.save(this.passageRepo.create(dto));
  }

  async updatePassage(
    id: string,
    dto: Partial<{ title: string; content: string; isActive: boolean }>,
  ) {
    const p = await this.passageRepo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Passage not found');
    Object.assign(p, dto);
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
      .leftJoinAndSelect('q.examTypeSubject', 'ets')
      .leftJoinAndSelect('ets.examType', 'et')
      .leftJoinAndSelect('ets.subject', 's')
      .leftJoinAndSelect('q.topic', 'topic')
      .orderBy('q.createdAt', 'DESC')
      .skip((opts.page - 1) * opts.limit)
      .take(opts.limit);

    if (opts.examTypeSubjectId)
      qb.andWhere('q.examTypeSubjectId = :etsId', {
        etsId: opts.examTypeSubjectId,
      });
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
        'examTypeSubject',
        'examTypeSubject.examType',
        'examTypeSubject.subject',
        'topic',
        'passage',
      ],
    });
    if (!q) throw new NotFoundException('Question not found');
    return q;
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  createQuestion(dto: {
    examTypeSubjectId: string;
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
    const q = this.questionRepo.create({
      ...dto,
      type: dto.type as QuestionType,
      category: dto.category as QuestionCategory,
      difficulty: dto.difficulty as QuestionDifficulty,
    });
    return this.questionRepo.save(q);
  }

  async updateQuestion(
    id: string,
    dto: Partial<{
      examTypeSubjectId: string;
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
    const q = await this.questionRepo.findOne({ where: { id } });
    if (!q) throw new NotFoundException('Question not found');
    Object.assign(q, dto);
    return this.questionRepo.save(q);
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */

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
        const q = this.questionRepo.create({
          examTypeSubjectId: raw.examTypeSubjectId as string,
          questionText: raw.questionText as string,
          type: raw.type as QuestionType,
          category: (raw.category ?? QuestionCategory.OBJECTIVES) as QuestionCategory,
          difficulty: (raw.difficulty ?? QuestionDifficulty.MEDIUM) as QuestionDifficulty,
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
      'examTypeSubjectId',
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
