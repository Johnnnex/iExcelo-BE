import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { SponsorProfile } from './sponsor-profile.entity';
import { StudentProfile } from '../../students/entities/student-profile.entity';
import { Subscription } from '../../subscriptions/entities';
import { BaseEntity } from '../../common/entities';
import { GenericStatus } from '../../../types';

@Entity('sponsorships')
export class Sponsorship extends BaseEntity {
  @Column()
  sponsorId: string;

  @Column()
  studentId: string;

  @Column()
  subscriptionId: string;

  @Column({
    type: 'enum',
    enum: Object.values(GenericStatus),
    default: GenericStatus.ACTIVE,
  })
  status: GenericStatus;

  @Column({ type: 'timestamp' })
  startDate: Date;

  @Column({ type: 'timestamp' })
  endDate: Date;

  @Column({ type: 'float', default: 0 })
  amountPaid: number;

  @Column({ nullable: true })
  planId: string;

  // Relations
  @ManyToOne(() => SponsorProfile, (profile) => profile.sponsorships, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'sponsorId' })
  sponsor: SponsorProfile;

  @ManyToOne(() => StudentProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'studentId' })
  student: StudentProfile;

  @ManyToOne(() => Subscription, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subscriptionId' })
  subscription: Subscription;
}
