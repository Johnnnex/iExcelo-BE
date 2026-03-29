import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { SubscriptionPlan } from './subscription-plan.entity';
import { Currency } from '../../../types';

@Entity('plan_prices')
@Index(['planId', 'currency'], { unique: true })
@Index(['isActive'])
export class PlanPrice extends BaseEntity {
  @Column()
  planId: string;

  @Column({
    type: 'enum',
    enum: Object.values(Currency),
  })
  currency: Currency;

  @Column({ type: 'float' })
  amount: number;

  @Column({ default: true })
  isActive: boolean;

  // Provider-specific price IDs for recurring subscriptions
  @Column({ nullable: true })
  stripePriceId: string; // Stripe price ID for recurring (e.g., 'price_xxx')

  @Column({ nullable: true })
  paystackPlanCode: string; // Paystack plan code for recurring

  @ManyToOne(() => SubscriptionPlan, (plan) => plan.prices, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'planId' })
  plan: SubscriptionPlan;
}
