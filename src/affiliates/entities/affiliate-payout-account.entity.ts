import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { AffiliateProfile } from './affiliate-profile.entity';
import { AffiliatePayout } from './affiliate-payout.entity';
import { Currency } from '../../../types';
import { BaseEntity } from '../../common/entities';

@Entity('affiliate_payout_accounts')
@Index(['affiliateId'])
@Index(['affiliateId', 'currency'])
export class AffiliatePayoutAccount extends BaseEntity {
  @Column()
  affiliateId: string;

  @Column({
    type: 'enum',
    enum: Object.values(Currency),
  })
  currency: Currency;

  @Column()
  bankName: string;

  @Column()
  accountNumber: string;

  @Column()
  accountName: string;

  @Column({ nullable: true, type: 'varchar' })
  bankCode: string | null;

  @Column({ default: false })
  isDefault: boolean;

  @ManyToOne(() => AffiliateProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'affiliateId' })
  affiliate: AffiliateProfile;

  @OneToMany(() => AffiliatePayout, (payout) => payout.payoutAccount)
  payouts: AffiliatePayout[];
}
