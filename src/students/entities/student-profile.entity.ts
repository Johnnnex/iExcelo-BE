import {
  Entity,
  Column,
  OneToOne,
  JoinColumn,
  ManyToOne,
  OneToMany,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { ExamType } from '../../exams/entities/exam-type.entity';
import { Subscription } from '../../subscriptions/entities';
import { ExamAttempt } from './exam-attempt.entity';
import { StudentExamType } from './student-exam-type.entity';
import { BaseEntity } from '../../common/entities';

@Entity('student_profiles')
@Index(['sponsorId'])
export class StudentProfile extends BaseEntity {
  @Column({ type: 'varchar' })
  userId: string;

  @Column({ nullable: true, type: 'varchar' })
  defaultExamTypeId: string | null; // Nullable initially, can be set during onboarding or later

  @Column({ nullable: true, type: 'varchar' })
  lastExamTypeId: string; // Tracks the last exam type the student used — defaults to defaultExamTypeId

  @Column({ default: 0 })
  totalQuestionsSolved: number;

  @Column({ default: 0 })
  totalCorrect: number;

  @Column({ default: 0 })
  totalWrong: number;

  @Column({ type: 'float', default: 0 })
  overallAccuracy: number; // Measured from totalWrong and totalCorrect

  @Column({ default: false })
  hasEverSubscribed: boolean;

  // Sponsorship — set when student is added by a sponsor (manual add or sponsor URL signup)
  @Column({ default: false })
  isSponsored: boolean;

  @Column({ nullable: true, type: 'varchar' })
  sponsorId: string | null; // FK → SponsorProfile.id

  @Column({ nullable: true, type: 'varchar' })
  sponsorUrlId: string | null; // FK → SponsorUrl.id — which URL they used to sign up (analytics)

  @Column({ nullable: true, type: 'varchar' })
  sponsorDisplayName: string | null; // Cached sponsor name (companyName or firstName+lastName)

  // Relations
  @OneToOne(() => User, (user) => user.studentProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => ExamType)
  @JoinColumn({ name: 'defaultExamTypeId' })
  defaultExamType: ExamType;

  @OneToMany(() => Subscription, (sub) => sub.student)
  subscriptions: Subscription[];

  @OneToMany(() => ExamAttempt, (attempt) => attempt.student)
  examAttempts: ExamAttempt[];

  @OneToMany(() => StudentExamType, (set) => set.student)
  examTypes: StudentExamType[];
}
