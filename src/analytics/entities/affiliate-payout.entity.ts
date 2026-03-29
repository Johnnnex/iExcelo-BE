import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { AffiliateProfile } from '../../affiliates/entities/affiliate-profile.entity';
import { BaseEntity } from '../../common/entities';
import { PayoutStatus } from '../../../types';

@Entity('affiliate_payouts')
@Index(['affiliateId', 'createdAt'])
export class AffiliatePayout extends BaseEntity {
  @Column()
  affiliateId: string;

  @Column({ type: 'float' })
  amount: number;

  @Column({
    type: 'enum',
    enum: Object.values(PayoutStatus),
    default: PayoutStatus.PENDING,
  })
  status: PayoutStatus;

  @Column({ nullable: true, type: 'varchar' })
  paymentMethod: string;

  @Column({ type: 'json', nullable: true })
  paymentDetails: Record<string, string>;

  @Column({ type: 'timestamp', nullable: true })
  processedAt: Date;

  @Column({ type: 'text', nullable: true })
  failureReason: string;

  // Relations
  @ManyToOne(() => AffiliateProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'affiliateId' })
  affiliate: AffiliateProfile;
}
