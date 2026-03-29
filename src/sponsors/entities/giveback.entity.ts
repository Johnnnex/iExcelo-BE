import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { SponsorProfile } from './sponsor-profile.entity';
import { BaseEntity } from '../../common/entities';
import { GivebackType, GivebackStatus, Currency } from '../../../types';

/**
 * One Giveback = one sponsor action (e.g. "subscribe 15 students" or "buy books for 6").
 * A single action produces many child records (Subscriptions, future BookPurchases, etc.)
 * linked back here via their givebackId.
 *
 * - type=SUBSCRIPTION → query subscriptions where givebackId = this.id
 * - type=BOOK_PURCHASE → query book_purchases where givebackId = this.id (future)
 *
 * Never store plan/examType here — those live on the child records.
 */
@Entity('givebacks')
@Index(['sponsorId'])
@Index(['sponsorId', 'status', 'endDate']) // Supports lazy-expiration UPDATE and expiring-soon queries
export class Giveback extends BaseEntity {
  @Column()
  sponsorId: string;

  @Column({
    type: 'enum',
    enum: Object.values(GivebackType),
  })
  type: GivebackType;

  @Column({ type: 'float', default: 0 })
  amount: number; // Total amount paid for this entire giveback action

  @Column({
    type: 'enum',
    enum: Object.values(Currency),
    default: Currency.NGN,
  })
  currency: Currency;

  // For type=SUBSCRIPTION: how many students were subscribed in this action
  @Column({ default: 0 })
  studentCount: number;

  // For future type=BOOK_PURCHASE: how many books were purchased
  @Column({ nullable: true, type: 'int' })
  bookCount: number | null;

  @Column({
    type: 'enum',
    enum: Object.values(GivebackStatus),
    default: GivebackStatus.PENDING,
  })
  status: GivebackStatus;

  // For type=SUBSCRIPTION: when all linked subscriptions expire (set on payment verification)
  // Null until payment confirmed. Same for every student in the batch (same plan/duration).
  @Column({ type: 'timestamp', nullable: true })
  endDate: Date | null;

  // Resub tracking
  @Column({ default: false })
  hasResubbed: boolean; // true once a follow-up giveback has been initiated for this batch

  @Column({ nullable: true, type: 'varchar' })
  parentGivebackId: string | null; // links a resub giveback back to the original

  // Relations
  @ManyToOne(() => SponsorProfile, (profile) => profile.givebacks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'sponsorId' })
  sponsor: SponsorProfile;
}
