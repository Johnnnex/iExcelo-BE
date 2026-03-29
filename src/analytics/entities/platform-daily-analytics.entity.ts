import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities';

// TODO: Move writes to RabbitMQ/Kafka when implementing push model
@Entity('platform_daily_analytics')
@Index(['date'], { unique: true })
export class PlatformDailyAnalytics extends BaseEntity {
  @Column({ type: 'date', unique: true })
  date: Date;

  // User Metrics
  @Column({ default: 0 })
  newStudents: number;

  @Column({ default: 0 })
  newSponsors: number;

  @Column({ default: 0 })
  newAffiliates: number;

  @Column({ default: 0 })
  activeStudents: number;

  @Column({ default: 0 })
  activeSponsors: number;

  @Column({ default: 0 })
  activeAffiliates: number;

  // Revenue Metrics
  @Column({ type: 'float', default: 0 })
  totalRevenue: number;

  @Column({ type: 'float', default: 0 })
  totalExpenses: number;

  @Column({ type: 'float', default: 0 })
  totalProfit: number;

  // Subscription Metrics
  @Column({ default: 0 })
  newSubscriptions: number;

  @Column({ default: 0 })
  cancelledSubscriptions: number;

  @Column({ default: 0 })
  demoUsers: number;

  @Column({ default: 0 })
  premiumUsers: number;
}
