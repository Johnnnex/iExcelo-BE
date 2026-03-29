import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  OneToOne,
} from 'typeorm';
import { AffiliateProfile } from './affiliate-profile.entity';
import { User } from '../../users/entities/user.entity';
import { ReferredUserType } from '../../../types';

@Entity('affiliate_referrals')
export class AffiliateReferral {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  affiliateId: string; // Who referred this user

  @Column()
  referredUserId: string; // The new user

  @Column({
    type: 'enum',
    enum: Object.values(ReferredUserType),
  })
  userType: ReferredUserType;

  @Column({ default: false })
  commissionPaid: boolean;

  @Column({ default: false })
  hasSubscribed: boolean;

  @Column({ type: 'timestamp', nullable: true })
  subscribedAt: Date | null;

  @Column({ type: 'float', default: 0 })
  totalRevenueGenerated: number;

  @CreateDateColumn()
  createdAt: Date;

  // Relations
  @ManyToOne(() => AffiliateProfile, (affiliate) => affiliate.referrals, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'affiliateId' })
  affiliate: AffiliateProfile;

  @OneToOne(() => User, (user) => user.referredBy)
  @JoinColumn({ name: 'referredUserId' })
  referredUser: User;
}
