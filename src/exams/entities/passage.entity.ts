import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { ExamTypeSubject } from './exam-type-subject.entity';
import { Question } from './question.entity';

/**
 * A shared reading passage/essay that multiple questions can reference.
 * Classic use case: "Read the passage below and answer questions 1–5."
 *
 * Scoped to one ExamTypeSubject (e.g. "WAEC English") via examTypeSubjectId.
 * Relationship: many questions → one passage (many-to-one on the question side).
 *
 * All text content is stored as Markdown + LaTeX.
 */
@Entity('passages')
export class Passage extends BaseEntity {
  @Column()
  examTypeSubjectId: string;

  @Column({ type: 'text' })
  title: string; // e.g. "Read the following passage carefully"

  @Column({ type: 'text' })
  content: string; // Markdown + LaTeX

  @Column({ default: true })
  isActive: boolean;

  // ─── Relations ────────────────────────────────────────────────────────────

  @ManyToOne(() => ExamTypeSubject, (ets) => ets.passages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'examTypeSubjectId' })
  examTypeSubject: ExamTypeSubject;

  @OneToMany(() => Question, (question) => question.passage)
  questions: Question[];
}
