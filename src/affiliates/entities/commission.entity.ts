import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { AffiliateProfile } from './affiliate-profile.entity';
import { AffiliateReferral } from './affiliate-referral.entity';
import { Subscription } from '../../subscriptions/entities/subscription.entity';
import { CommissionStatus, Currency } from '../../../types';
import { BaseEntity } from '../../common/entities';

@Entity('commissions')
export class Commission extends BaseEntity {
  @Column()
  affiliateId: string;

  @Column()
  referralId: string;

  @Column({ type: 'float' })
  amount: number; // 15% of subscription price

  @Column({
    type: 'enum',
    enum: Object.values(CommissionStatus),
    default: CommissionStatus.PENDING,
  })
  status: CommissionStatus;

  @Column({ type: 'timestamp', nullable: true })
  paidAt: Date;

  @Column({ nullable: true })
  subscriptionId: string;

  @Column({ type: 'float', nullable: true })
  subscriptionAmount: number;

  @Column({
    type: 'enum',
    enum: Object.values(Currency),
    nullable: true,
  })
  currency: Currency;

  @Column({ type: 'varchar', nullable: true })
  planName: string;

  // Relations
  @ManyToOne(() => AffiliateProfile, (profile) => profile.commissions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'affiliateId' })
  affiliate: AffiliateProfile;

  @ManyToOne(() => AffiliateReferral, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'referralId' })
  referral: AffiliateReferral;

  @ManyToOne(() => Subscription, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subscriptionId' })
  subscription: Subscription;
}
