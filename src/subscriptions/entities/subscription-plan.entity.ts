import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { ExamType } from '../../exams/entities/exam-type.entity';
import { BaseEntity } from '../../common/entities';
import { Subscription } from './subscription.entity';
import { PlanPrice } from './plan-price.entity';

@Entity('subscription_plans')
@Index(['examTypeId', 'isActive'])
export class SubscriptionPlan extends BaseEntity {
  @Column()
  examTypeId: string;

  @Column()
  name: string; // "1 Month", "2 Months", "6 Months"

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column()
  durationDays: number; // 30, 60, 180

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: 0 })
  sortOrder: number; // For ordering plans in UI

  // Stripe product ID (create in Stripe dashboard, one product per plan)
  // A "Product" in Stripe represents the plan (e.g., "2-Month Plan")
  // Each Product has multiple "Prices" (stored in PlanPrice entity)
  @Column({ nullable: true })
  stripeProductId: string;

  // Relations
  @ManyToOne(() => ExamType, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'examTypeId' })
  examType: ExamType;

  @OneToMany(() => Subscription, (sub) => sub.plan)
  subscriptions: Subscription[];

  @OneToMany(() => PlanPrice, (price) => price.plan)
  prices: PlanPrice[];
}
