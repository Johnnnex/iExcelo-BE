import { Entity, Column, OneToOne, JoinColumn, OneToMany } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { AffiliateReferral } from './affiliate-referral.entity';
import { Commission } from './commission.entity';
import { BaseEntity } from '../../common/entities';

@Entity('affiliate_profiles')
export class AffiliateProfile extends BaseEntity {
  @Column()
  userId: string;

  @Column({ unique: true })
  affiliateCode: string; // e.g., "AFF-ABC123"

  @Column({ default: 0 })
  totalReferrals: number;

  @Column({ type: 'float', default: 0 })
  totalEarnings: number;

  @Column({ type: 'float', default: 0 })
  pendingBalance: number;

  @Column({ default: 0 })
  totalConversions: number;

  @Column({ type: 'float', default: 0 })
  totalPaidOut: number;

  // Relations
  @OneToOne(() => User, (user) => user.affiliateProfile, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: User;

  @OneToMany(() => AffiliateReferral, (referral) => referral.affiliate)
  referrals: AffiliateReferral[];

  @OneToMany(() => Commission, (commission) => commission.affiliate)
  commissions: Commission[];
}
