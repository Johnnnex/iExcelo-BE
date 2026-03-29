import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { SponsorProfile } from './sponsor-profile.entity';
import { StudentProfile } from '../../students/entities/student-profile.entity';
import { MessageStatus } from '../../../types';
import { BaseEntity } from '../../common/entities';

@Entity('messages')
export class Message extends BaseEntity {
  @Column()
  sponsorId: string;

  @Column()
  studentId: string;

  @Column({ type: 'text' })
  content: string;

  @Column({
    type: 'enum',
    enum: Object.values(MessageStatus),
    default: MessageStatus.PENDING,
  })
  status: MessageStatus;

  @Column()
  reasonForRejection: string;

  @Column({ default: false })
  read: boolean;

  // Relations
  @ManyToOne(() => SponsorProfile, (profile) => profile.messages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'sponsorId' })
  sponsor: SponsorProfile;

  @ManyToOne(() => StudentProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'studentId' })
  student: StudentProfile;
}
