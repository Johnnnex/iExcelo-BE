import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { PaymentProvider, WebhookEventType } from '../../../types';

@Entity('webhook_events')
@Index(['provider', 'providerEventId'], { unique: true })
@Index(['processedAt'])
@Index(['isProcessed'])
export class WebhookEvent extends BaseEntity {
  @Column({
    type: 'enum',
    enum: Object.values(PaymentProvider),
  })
  provider: PaymentProvider;

  @Column()
  providerEventId: string;

  @Column({
    type: 'enum',
    enum: Object.values(WebhookEventType),
  })
  eventType: WebhookEventType;

  @Column({ type: 'jsonb' })
  payload: Record<string, any>;

  @Column({ type: 'timestamp', nullable: true })
  processedAt: Date;

  @Column({ default: false })
  isProcessed: boolean;

  @Column({ type: 'text', nullable: true })
  processingError: string | null;

  @Column({ default: 0 })
  retryCount: number;
}
