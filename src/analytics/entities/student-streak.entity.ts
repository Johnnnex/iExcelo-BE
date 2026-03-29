import { Entity, Column, OneToOne, JoinColumn } from 'typeorm';
import { StudentProfile } from '../../students/entities/student-profile.entity';
import { BaseEntity } from '../../common/entities';

// TODO: Move streak updates to RabbitMQ/Kafka when implementing push model
@Entity('student_streaks')
export class StudentStreak extends BaseEntity {
  @Column({ unique: true })
  studentId: string;

  @Column({ default: 0 })
  currentStreak: number;

  @Column({ default: 0 })
  longestStreak: number;

  @Column({ type: 'date', nullable: true })
  lastActivityDate: Date | null;

  // Relations
  @OneToOne(() => StudentProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'studentId' })
  student: StudentProfile;
}
