import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { StudentProfile } from '../../students/entities/student-profile.entity';
import { ExamType } from '../../exams/entities/exam-type.entity';
import { Subject } from '../../exams/entities/subject.entity';
import { BaseEntity } from '../../common/entities';

// TODO: Move writes to RabbitMQ/Kafka when implementing push model
@Entity('student_subject_analytics')
@Index(['studentId', 'examTypeId', 'subjectId', 'date'], { unique: true })
export class StudentSubjectAnalytics extends BaseEntity {
  @Column()
  studentId: string;

  @Column()
  examTypeId: string;

  @Column()
  subjectId: string;

  @Column({ type: 'date' })
  date: Date;

  // Note: Always stored as daily records. Aggregation happens at query time.

  @Column({ default: 0 })
  questionsAttempted: number;

  @Column({ default: 0 })
  questionsCorrect: number;

  @Column({ default: 0 })
  questionsWrong: number;

  @Column({ type: 'float', default: 0 })
  accuracyPercentage: number;

  @Column({ type: 'float', default: 0 })
  averageScore: number;

  @Column({ default: 0 })
  essayQuestionsAttempted: number;

  // Relations
  @ManyToOne(() => StudentProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'studentId' })
  student: StudentProfile;

  @ManyToOne(() => ExamType, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'examTypeId' })
  examType: ExamType;

  @ManyToOne(() => Subject, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subjectId' })
  subject: Subject;
}
