import { Entity, Column, OneToMany } from 'typeorm';
import { ExamTypeSubject } from './exam-type-subject.entity';
import { BaseEntity } from '../../common/entities';

@Entity('subjects')
export class Subject extends BaseEntity {
  @Column()
  name: string; // Mathematics, English, Physics

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ default: 0 })
  totalQuestions: number;

  @Column({ default: true })
  isActive: boolean;

  // ─── Relations ─────────────────────────────────────────────────────────

  @OneToMany(() => ExamTypeSubject, (ets) => ets.subject)
  examTypeSubjects: ExamTypeSubject[];
}
