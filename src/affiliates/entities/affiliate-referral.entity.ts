import { Entity, Column, ManyToOne, JoinColumn, OneToOne } from 'typeorm';
import { AffiliateProfile } from './affiliate-profile.entity';
import { User } from '../../users/entities/user.entity';
import { ReferredUserType } from '../../../types';
import { BaseEntity } from '../../common/entities';

@Entity('affiliate_referrals')
export class AffiliateReferral extends BaseEntity {
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
