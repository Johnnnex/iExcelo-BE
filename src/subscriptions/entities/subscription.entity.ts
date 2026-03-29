import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { StudentProfile } from '../../students/entities/student-profile.entity';
import { ExamType } from '../../exams/entities/exam-type.entity';
import { SponsorProfile } from '../../sponsors/entities/sponsor-profile.entity';
import { SubscriptionPlan } from './subscription-plan.entity';
import { PlanPrice } from './plan-price.entity';
import { Transaction } from './transaction.entity';
import { BaseEntity } from '../../common/entities';
import { SubscriptionStatus, PaymentProvider, Currency } from '../../../types';

@Entity('subscriptions')
@Index(['studentId', 'examTypeId'])
@Index(['status'])
@Index(['endDate'])
@Index(['providerSubscriptionId'])
export class Subscription extends BaseEntity {
  @Column()
  studentId: string;

  @Column()
  examTypeId: string;

  @Column()
  planId: string;

  @Column({ nullable: true })
  planPriceId: string; // Links to the exact PlanPrice (currency-specific) that was purchased

  @Column({ nullable: true })
  sponsorId: string;

  @Column({ nullable: true })
  studentExamTypeId: string; // Direct link to StudentExamType for easier isPaid updates

  @Column({ type: 'timestamp', nullable: true })
  startDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  endDate: Date;

  @Column({
    type: 'enum',
    enum: Object.values(SubscriptionStatus),
    default: SubscriptionStatus.PENDING,
  })
  status: SubscriptionStatus;

  @Column({ type: 'float', default: 0 })
  amountPaid: number;

  @Column({
    type: 'enum',
    enum: Object.values(Currency),
    default: Currency.NGN,
  })
  currency: Currency;

  @Column({
    type: 'enum',
    enum: Object.values(PaymentProvider),
  })
  paymentProvider: PaymentProvider;

  @Column({ nullable: true })
  providerSubscriptionId: string; // stripe_sub_xxx or paystack_sub_xxx

  @Column({ nullable: true })
  providerCustomerId: string; // stripe customer or paystack customer

  @Column({ default: false })
  autoRenew: boolean;

  @Column({ nullable: true })
  lastPaymentStatus: string; // 'succeeded', 'failed', 'pending'

  @Column({ type: 'timestamp', nullable: true })
  cancelledAt: Date;

  // Giveback link — set when this subscription was created by a sponsor giveback action
  @Column({ nullable: true, type: 'varchar' })
  givebackId: string | null;

  // Relations
  @ManyToOne(() => StudentProfile, (profile) => profile.subscriptions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'studentId' })
  student: StudentProfile;

  @ManyToOne(() => ExamType, (examType) => examType.subscriptions)
  @JoinColumn({ name: 'examTypeId' })
  examType: ExamType;

  @ManyToOne(() => SubscriptionPlan, (subPlan) => subPlan.subscriptions)
  @JoinColumn({ name: 'planId' })
  plan: SubscriptionPlan;

  @ManyToOne(() => PlanPrice, { nullable: true })
  @JoinColumn({ name: 'planPriceId' })
  planPrice: PlanPrice; // The exact price paid (includes currency, amount, provider IDs)

  @ManyToOne(() => SponsorProfile, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'sponsorId' })
  sponsor: SponsorProfile;

  @OneToMany(() => Transaction, (transaction) => transaction.subscription)
  transactions: Transaction[];
}
