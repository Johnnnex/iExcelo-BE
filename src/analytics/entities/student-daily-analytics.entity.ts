import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { StudentProfile } from '../../students/entities/student-profile.entity';
import { ExamType } from '../../exams/entities/exam-type.entity';
import { BaseEntity } from '../../common/entities';

// TODO: Move writes to RabbitMQ/Kafka when implementing push model
@Entity('student_daily_analytics')
@Index(['studentId', 'examTypeId', 'date'], { unique: true })
export class StudentDailyAnalytics extends BaseEntity {
  @Column()
  studentId: string;

  @Column()
  examTypeId: string;

  @Column({ type: 'date' })
  date: Date;

  @Column({ default: 0 })
  questionsAttempted: number;

  @Column({ default: 0 })
  questionsCorrect: number;

  @Column({ default: 0 })
  questionsWrong: number;

  @Column({ default: 0 })
  questionsUnanswered: number;

  @Column({ type: 'float', default: 0 })
  accuracyPercentage: number;

  @Column({ default: 0 })
  examsCompleted: number;

  @Column({ type: 'float', default: 0 })
  averageScore: number;

  @Column({ default: 0 })
  totalTimeSpentSeconds: number;

  // Relations
  @ManyToOne(() => StudentProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'studentId' })
  student: StudentProfile;

  @ManyToOne(() => ExamType, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'examTypeId' })
  examType: ExamType;
}
