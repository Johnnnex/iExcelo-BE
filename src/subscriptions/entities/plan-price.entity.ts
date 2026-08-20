import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { SubscriptionPlan } from './subscription-plan.entity';
import { PlanPriceProvider } from './plan-price-provider.entity';
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

  @ManyToOne(() => SubscriptionPlan, (plan) => plan.prices, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'planId' })
  plan: SubscriptionPlan;

  @OneToMany(() => PlanPriceProvider, (ppp) => ppp.planPrice, {
    cascade: true,
  })
  providers: PlanPriceProvider[];
}
