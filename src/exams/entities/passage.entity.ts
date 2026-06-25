import { Entity, Column, ManyToMany, JoinTable, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { ExamTypeSubject } from './exam-type-subject.entity';
import { Question } from './question.entity';

/**
 * A shared reading passage/essay that multiple questions can reference.
 *
 * Linked to one or more ExamTypeSubjects via a many-to-many join table
 * (passage_exam_type_subjects). A single passage can appear in both
 * "WAEC English" and "NECO English" without being duplicated.
 *
 * All text content is stored as Markdown + LaTeX.
 */
@Entity('passages')
export class Passage extends BaseEntity {
  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ default: true })
  isActive: boolean;

  // ─── Relations ────────────────────────────────────────────────────────────

  @ManyToMany(() => ExamTypeSubject, (ets) => ets.passages)
  @JoinTable({
    name: 'passage_exam_type_subjects',
    joinColumn: { name: 'passageId', referencedColumnName: 'id' },
    inverseJoinColumn: {
      name: 'examTypeSubjectId',
      referencedColumnName: 'id',
    },
  })
  examTypeSubjects: ExamTypeSubject[];

  @OneToMany(() => Question, (question) => question.passage)
  questions: Question[];
}
