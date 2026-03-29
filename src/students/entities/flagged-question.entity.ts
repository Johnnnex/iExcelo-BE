import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { StudentProfile } from './student-profile.entity';
import { Question } from '../../exams/entities/question.entity';
import { FlagReasons } from '../../../types';
import { BaseEntity } from '../../common/entities';

@Entity('flagged_questions')
export class FlaggedQuestion extends BaseEntity {
  @Column()
  studentId: string;

  @Column()
  questionId: string;

  @Column({ type: 'text', nullable: true })
  reason: string; // There shouldn't be a reason, optional, just incase....

  @Column({
    type: 'enum',
    enum: Object.values(FlagReasons),
    default: FlagReasons.ERROR,
  })
  flagType: FlagReasons;

  @Column({ default: false })
  adminReviewed: boolean;

  @Column({ type: 'timestamp' })
  flaggedAt: Date;

  // Relations
  @ManyToOne(() => StudentProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'studentId' })
  student: StudentProfile;

  @ManyToOne(() => Question)
  @JoinColumn({ name: 'questionId' })
  question: Question;
}
