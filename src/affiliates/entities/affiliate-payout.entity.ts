import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { AffiliateProfile } from './affiliate-profile.entity';
import { AffiliatePayoutAccount } from './affiliate-payout-account.entity';
import { Currency, PayoutStatus } from '../../../types';
import { BaseEntity } from '../../common/entities';

@Entity('affiliate_payouts')
@Index(['affiliateId', 'createdAt'])
@Index(['affiliateId', 'currency'])
export class AffiliatePayout extends BaseEntity {
  @Column()
  affiliateId: string;

  @Column({ nullable: true, type: 'varchar' })
  payoutAccountId: string | null;

  @Column({ type: 'float' })
  amount: number;

  @Column({
    type: 'enum',
    enum: Object.values(Currency),
  })
  currency: Currency;

  @Column({
    type: 'enum',
    enum: Object.values(PayoutStatus),
    default: PayoutStatus.PENDING,
  })
  status: PayoutStatus;

  @Column({ type: 'timestamp', nullable: true })
  processedAt: Date;

  @Column({ type: 'text', nullable: true })
  failureReason: string;

  @ManyToOne(() => AffiliateProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'affiliateId' })
  affiliate: AffiliateProfile;

  @ManyToOne(() => AffiliatePayoutAccount, (account) => account.payouts, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'payoutAccountId' })
  payoutAccount: AffiliatePayoutAccount;
}
