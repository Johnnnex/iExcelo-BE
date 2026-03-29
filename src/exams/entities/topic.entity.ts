import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { Subject } from './subject.entity';
import type { Question } from './question.entity';

/**
 * A topic/concept that belongs to a Subject.
 * Topics are subject-scoped (not exam-type-scoped) — "Differentiation" under
 * Mathematics applies regardless of exam type.
 *
 * Topics power two features:
 *  1. The /student/topics syllabus page — rich study reference material.
 *  2. Topic-priority question selection — when a student picks topics before
 *     starting an exam, those topic IDs are sent to the backend which
 *     prioritises questions tagged with those topics, then falls back to the
 *     general pool to meet the requested quota.
 *
 * Table: topics
 */
@Entity('topics')
@Index(['subjectId'])
@Index(['subjectId', 'name'], { unique: true })
export class Topic extends BaseEntity {
  @Column()
  subjectId: string;

  // Human-readable topic name (e.g. "Differentiation", "Gas Laws")
  @Column()
  name: string;

  // Full study content — Markdown + LaTeX + Cloudinary image URLs.
  // Displayed on the /student/topics/:id detail page.
  @Column({ type: 'text', nullable: true })
  content: string;

  @Column({ default: true })
  isActive: boolean;

  // ─── Relations ────────────────────────────────────────────────────────────

  @ManyToOne(() => Subject, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subjectId' })
  subject: Subject;

  @OneToMany('Question', 'topic')
  questions: Question[];
}
