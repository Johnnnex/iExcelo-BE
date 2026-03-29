import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { StudentProfile } from './student-profile.entity';
import { ExamType } from '../../exams/entities/exam-type.entity';
import { BaseEntity } from '../../common/entities';
import { ExamAttemptStatus, ExamTypes, QuestionAnswer } from '../../../types';

@Entity('exam_attempts')
export class ExamAttempt extends BaseEntity {
  @Column()
  studentId: string;

  @Column()
  examTypeId: string;

  @Column({ type: 'enum', enum: Object.values(ExamTypes) })
  mode: ExamTypes;

  @Column({ type: 'json' })
  selectedSubjects: string[]; // Array of subject IDs

  @Column()
  totalQuestions: number;

  @Column({ default: 0 })
  correctAnswers: number;

  @Column({ default: 0 })
  wrongAnswers: number;

  @Column({ default: 0 })
  unanswered: number;

  @Column({ type: 'float', default: 0 })
  scorePercentage: number;

  @Column({ type: 'float', default: 0 })
  totalMarksObtained: number;

  @Column({ type: 'float', default: 0 })
  totalMarksPossible: number;

  @Column({ type: 'json' })
  questionResponses: Array<{
    questionId: string;
    answer: QuestionAnswer; // Polymorphic: string | string[] | Record<string,string>
    isCorrect: boolean | null; // null = essay (exempt from metrics)
    marksAwarded: number;
    timeSpent: number; // seconds on this question
    feedback?: string; // e.g. "Matched 3/5 keywords"
    exemptFromMetrics?: boolean; // true for essays
    isFlagged?: boolean; // true if student flagged this question
    flagType?: string; // FlagReasons value
  }>;

  @Column({ default: 0 })
  timeSpentSeconds: number;

  @Column({ nullable: true })
  timeLimitSeconds: number; // null for revision mode

  @Column({
    type: 'enum',
    enum: Object.values(ExamAttemptStatus),
    default: ExamAttemptStatus.IN_PROGRESS,
  })
  status: ExamAttemptStatus;

  @Column({ type: 'timestamp' })
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;

  // All question IDs for this attempt (ordered). Used for paginated /questions endpoint.
  // Stored so the order is deterministic across page loads.
  @Column({ type: 'json', nullable: true })
  questionIds: string[];

  // Draft responses saved by the frontend for refresh recovery.
  // Shape mirrors IQuestionResponse[] but stored as-is (no grading).
  @Column({ type: 'json', nullable: true })
  draftResponses: Record<string, any> | null;

  // Relations
  @ManyToOne(() => StudentProfile, (profile) => profile.examAttempts, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'studentId' })
  student: StudentProfile;

  @ManyToOne(() => ExamType)
  @JoinColumn({ name: 'examTypeId' })
  examType: ExamType;
}
