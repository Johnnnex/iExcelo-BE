import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { ExamTypeSubject } from './exam-type-subject.entity';
import { Passage } from './passage.entity';
import { Topic } from './topic.entity';
import {
  QuestionCategory,
  QuestionDifficulty,
  QuestionType,
} from '../../../types';
import { BaseEntity } from '../../common/entities';

@Entity('questions')
export class Question extends BaseEntity {
  // Optional: link to a shared reading passage
  @Column({ nullable: true })
  passageId: string;

  // Markdown + LaTeX string.
  // Inline images:  ![alt](cloudinary-url)
  // Inline math:    $x^2 + y^2 = z^2$
  // Block math:     $$\int_a^b f(x)\,dx$$
  @Column({ type: 'text' })
  questionText: string;

  // Each option.text is also a Markdown + LaTeX string.
  // isCorrect is server-side only — stripped from student-facing responses.
  @Column({ type: 'json', nullable: true })
  options: Array<{ id: string; text: string; isCorrect: boolean }>;

  @Column({ type: 'enum', enum: Object.values(QuestionType) })
  type: string;

  // Polymorphic — shape depends on question type:
  //   MULTIPLE_CHOICE / TRUE_FALSE / FILL_IN_THE_BLANK  → string
  //   MULTIPLE_RESPONSE / SHORT_ANSWER (keywords)       → string[]
  //   MATCHING                                           → Record<string, string>
  //   ESSAY → string (examiner's model answer shown in revision/timed mode)
  //
  // NEVER sent to students in the start-exam response.
  // Only included for revision/timed mode (not mock).
  @Column({ type: 'json', nullable: true })
  correctAnswer: any;

  // FK to the Topic entity — nullable so questions without a topic assignment still work.
  @Column({ nullable: true })
  topicId: string;

  // ─── Topic relation ────────────────────────────────────────────────────────
  @ManyToOne(() => Topic, (t) => t.questions, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'topicId' })
  topic: Topic;

  // Explanation (Markdown + LaTeX). Shown after answer is revealed.
  @Column({ type: 'text', nullable: true })
  explanation: string | null;

  // Storage format for questionText and explanation.
  // 'markdown' = tiptap-markdown string (legacy)
  // 'plate'    = JSON.stringify(Plate Slate nodes)
  @Column({ type: 'varchar', length: 20, default: 'markdown' })
  contentFormat: 'markdown' | 'plate';

  // Plate.js discussion/comment thread metadata.
  // Stores the TDiscussion[] from discussionPlugin.options.discussions.
  // Comment marks (highlighting) live in questionText JSON; this stores the message content.
  @Column({ type: 'json', nullable: true })
  discussions: unknown[] | null;

  // Per-type validation config
  @Column({ type: 'json', nullable: true })
  validationConfig: {
    caseSensitive?: boolean;
    allowPartialCredit?: boolean;
    keywordMinMatch?: number;
  };

  // Which category of the exam this question belongs to.
  // Must be one of the exam type's supportedCategories.
  @Column({
    type: 'enum',
    enum: Object.values(QuestionCategory),
    default: QuestionCategory.OBJECTIVES,
  })
  category: string;

  @Column({
    type: 'enum',
    enum: Object.values(QuestionDifficulty),
    default: QuestionDifficulty.MEDIUM,
  })
  difficulty: string;

  @Column({ type: 'float', default: 1 })
  marks: number;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: 0 })
  timesAttempted: number;

  @Column({ default: 0 })
  timesCorrect: number;

  // Legacy question ID from the original iExcelo site — used for idempotent import.
  // Can be dropped (set to null or removed) once migration is verified complete.
  @Column({ nullable: true, unique: true })
  legacyId: string;

  // ─── Relations ────────────────────────────────────────────────────────────

  // Many-to-many with ExamTypeSubject — one question can appear in multiple
  // exam types (e.g. WAEC, NECO, GCE) without being duplicated.
  @ManyToMany(() => ExamTypeSubject, (ets) => ets.questions)
  @JoinTable({
    name: 'question_exam_type_subjects',
    joinColumn: { name: 'questionId', referencedColumnName: 'id' },
    inverseJoinColumn: {
      name: 'examTypeSubjectId',
      referencedColumnName: 'id',
    },
  })
  examTypeSubjects: ExamTypeSubject[];

  @ManyToOne(() => Passage, (passage) => passage.questions, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'passageId' })
  passage: Passage;
}
