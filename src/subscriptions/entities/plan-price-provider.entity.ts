import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { PlanPrice } from './plan-price.entity';
import { PaymentProvider } from '../../../types';

@Entity('plan_price_providers')
@Index(['planPriceId', 'provider'], { unique: true })
export class PlanPriceProvider extends BaseEntity {
  @Column()
  planPriceId: string;

  @Column({
    type: 'enum',
    enum: Object.values(PaymentProvider),
  })
  provider: PaymentProvider;

  @Column({ nullable: true })
  externalId: string;

  @Column({ default: true })
  isActive: boolean;

  @ManyToOne(() => PlanPrice, (price) => price.providers, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'planPriceId' })
  planPrice: PlanPrice;
}
