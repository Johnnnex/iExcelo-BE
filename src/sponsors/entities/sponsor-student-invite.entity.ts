import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { SponsorProfile } from './sponsor-profile.entity';
import { BaseEntity } from '../../common/entities';
import { SponsorInviteStatus } from '../../../types';

@Entity('sponsor_student_invites')
@Index(['token'])
@Index(['sponsorId'])
@Index(['studentEmail'])
export class SponsorStudentInvite extends BaseEntity {
  @Column()
  sponsorId: string;

  @Column()
  studentEmail: string;

  @Column({ nullable: true })
  examTypeId: string; // Exam type assigned by sponsor on manual add

  @Column() // SHA-256 hashed token — raw token goes in the email URL
  token: string;

  @Column({
    type: 'enum',
    enum: Object.values(SponsorInviteStatus),
    default: SponsorInviteStatus.PENDING,
  })
  status: SponsorInviteStatus;

  @Column({ type: 'timestamp' })
  expiresAt: Date; // 7 days from creation

  @Column({ type: 'timestamp', nullable: true })
  acceptedAt: Date | null;

  // Relations
  @ManyToOne(() => SponsorProfile, (profile) => profile.studentInvites, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'sponsorId' })
  sponsor: SponsorProfile;
}
