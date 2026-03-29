import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { StudentProfile } from './student-profile.entity';
import { ExamType } from '../../exams/entities/exam-type.entity';
import { Subscription } from '../../subscriptions/entities';
import { BaseEntity } from '../../common/entities';

@Entity('student_exam_types')
export class StudentExamType extends BaseEntity {
  @Column()
  studentId: string;

  @Column()
  examTypeId: string;

  @Column({ nullable: true, type: 'varchar' })
  subscriptionId: string | null; // Links to the subscription that powers this access (if isPaid is true)

  @Column({ default: false })
  isDemoAllowed: boolean; // Only one exam type per student can have this as true

  @Column({ default: false })
  isPaid: boolean; // Whether student has paid for this exam type

  // Relations
  @ManyToOne(() => StudentProfile, (profile) => profile.examTypes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'studentId' })
  student: StudentProfile;

  @ManyToOne(() => ExamType, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'examTypeId' })
  examType: ExamType;

  @ManyToOne(() => Subscription, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'subscriptionId' })
  subscription: Subscription;
}
