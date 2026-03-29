import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { StudentProfile } from './student-profile.entity';
import { Question } from '../../exams/entities/question.entity';
import { BaseEntity } from '../../common/entities';

@Entity('question_progress')
@Index(['studentId', 'questionId'], { unique: true }) // required for batch upsert ON CONFLICT
export class QuestionProgress extends BaseEntity {
  @Column()
  studentId: string;

  @Column()
  questionId: string;

  @Column({ default: false })
  isDone: boolean; // Marked as done after answering

  @Column({ default: 0 })
  timesAttempted: number;

  @Column({ default: 0 })
  timesCorrect: number;

  @Column({ default: 0 })
  timesWrong: number;

  @Column({ type: 'timestamp', nullable: true })
  lastAttempted: Date;

  // Relations
  @ManyToOne(() => StudentProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'studentId' })
  student: StudentProfile;

  @ManyToOne(() => Question, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'questionId' })
  question: Question;
}
