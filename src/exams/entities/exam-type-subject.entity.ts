import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { ExamType } from './exam-type.entity';
import { Subject } from './subject.entity';

// Forward-declare to avoid circular import issues at module load time
import type { Question } from './question.entity';
import type { Passage } from './passage.entity';

/**
 * Explicit join entity between ExamType and Subject.
 *
 * Replaces the implicit TypeORM @ManyToMany join table so that:
 *  - "JAMB Mathematics" is a first-class entity with its own UUID
 *  - Questions and Passages FK to this entity (one FK instead of two)
 *  - DB enforces that the (examTypeId, subjectId) pair is valid
 *
 * Table: exam_type_subjects
 */
@Entity('exam_type_subjects')
@Index(['examTypeId', 'subjectId'], { unique: true })
export class ExamTypeSubject extends BaseEntity {
  @Column()
  examTypeId: string;

  @Column()
  subjectId: string;

  // ─── Relations ─────────────────────────────────────────────────────────

  @ManyToOne(() => ExamType, (et) => et.examTypeSubjects, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'examTypeId' })
  examType: ExamType;

  @ManyToOne(() => Subject, (s) => s.examTypeSubjects, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'subjectId' })
  subject: Subject;

  @OneToMany('Question', 'examTypeSubject')
  questions: Question[];

  @OneToMany('Passage', 'examTypeSubject')
  passages: Passage[];
}
