import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { AffiliateProfile } from '../../affiliates/entities/affiliate-profile.entity';
import { BaseEntity } from '../../common/entities';

// TODO: Move writes to RabbitMQ/Kafka when implementing push model
@Entity('affiliate_daily_analytics')
@Index(['affiliateId', 'date'], { unique: true })
export class AffiliateDailyAnalytics extends BaseEntity {
  @Column()
  affiliateId: string;

  @Column({ type: 'date' })
  date: Date;

  @Column({ default: 0 })
  newReferrals: number;

  @Column({ default: 0 })
  conversions: number;

  // Relations
  @ManyToOne(() => AffiliateProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'affiliateId' })
  affiliate: AffiliateProfile;
}
