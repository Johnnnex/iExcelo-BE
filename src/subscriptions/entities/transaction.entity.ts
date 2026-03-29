/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { StudentProfile } from '../../students/entities/student-profile.entity';
import { StudentExamType } from '../../students/entities/student-exam-type.entity';
import { SponsorProfile } from '../../sponsors/entities/sponsor-profile.entity';
import { Subscription } from './subscription.entity';
import {
  PaymentProvider,
  PaymentStatus,
  Currency,
  TransactionType,
} from '../../../types';

@Entity('transactions')
@Index(['studentId', 'createdAt'])
@Index(['studentId'])
@Index(['sponsorId'])
@Index(['subscriptionId'])
@Index(['studentExamTypeId'])
@Index(['providerTransactionId'])
export class Transaction extends BaseEntity {
  @Column()
  studentId: string;

  @Column({ nullable: true })
  sponsorId: string;

  @Column({ nullable: true })
  studentExamTypeId: string;

  @Column({ nullable: true })
  subscriptionId: string;

  @Column({
    type: 'enum',
    enum: Object.values(TransactionType),
    default: TransactionType.SUBSCRIPTION_PURCHASE,
  })
  type: TransactionType;

  @Column({ type: 'float' })
  amount: number;

  @Column({
    type: 'enum',
    enum: Object.values(Currency),
    default: Currency.NGN,
  })
  currency: Currency;

  @Column({ nullable: true })
  region: string;

  @Column({
    type: 'enum',
    enum: Object.values(PaymentProvider),
  })
  provider: PaymentProvider;

  @Column({
    type: 'enum',
    enum: Object.values(PaymentStatus),
    default: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  @Column({ nullable: true })
  providerTransactionId: string;

  @Column({ nullable: true })
  providerCustomerId: string;

  @Column({ type: 'jsonb', nullable: true })
  providerResponse: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  failureReason: string;

  @Column({ type: 'timestamp', nullable: true })
  paidAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date;

  // Relations
  @ManyToOne(() => StudentProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'studentId' })
  student: StudentProfile;

  @ManyToOne(() => StudentExamType, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'studentExamTypeId' })
  studentExamType: StudentExamType;

  @ManyToOne(() => Subscription, (sub) => sub.transactions, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'subscriptionId' })
  subscription: Subscription;

  @ManyToOne(() => SponsorProfile, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'sponsorId' })
  sponsor: SponsorProfile;
}
