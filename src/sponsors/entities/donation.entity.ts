import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { SponsorProfile } from './sponsor-profile.entity';
import { BaseEntity } from '../../common/entities';
import { Currency, DonationType } from '../../../types';

@Entity('donations')
export class Donation extends BaseEntity {
  @Column()
  sponsorId: string;

  @Column({ type: 'float' })
  amount: number;

  @Column({
    default: Currency.NGN,
    type: 'enum',
    enum: Object.values(Currency),
  })
  currency: Currency;

  @Column({
    type: 'enum',
    enum: Object.values(DonationType),
    default: DonationType.GENERAL,
  })
  type: DonationType;

  @Column({ type: 'text', nullable: true })
  description: string;

  // Relations
  @ManyToOne(() => SponsorProfile, (profile) => profile.donations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'sponsorId' })
  sponsor: SponsorProfile;
}
