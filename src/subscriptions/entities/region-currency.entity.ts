import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { Currency, PaymentProvider } from '../../../types';

@Entity('region_currencies')
@Index(['regionCode'], { unique: true })
@Index(['isActive'])
export class RegionCurrency extends BaseEntity {
  @Column({ unique: true })
  regionCode: string; // ISO 3166-1 alpha-2 country code (e.g., 'NG', 'US', 'GB')

  @Column()
  regionName: string; // Human-readable name (e.g., 'Nigeria', 'United States')

  @Column({
    type: 'enum',
    enum: Object.values(Currency),
    default: Currency.USD,
  })
  currency: Currency;

  @Column({
    type: 'enum',
    enum: Object.values(PaymentProvider),
    default: PaymentProvider.STRIPE,
  })
  paymentProvider: PaymentProvider;

  @Column({ default: true })
  isActive: boolean;
}
