import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { User } from '../../users/entities/user.entity';

/**
 * Stores a browser's Web Push subscription for a user.
 * One user may have multiple subscriptions (different devices/browsers).
 * Stale subscriptions (410 from push provider) are deleted automatically by PushService.
 */
@Entity('push_subscriptions')
@Index(['userId'])
export class PushSubscription extends BaseEntity {
  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  /** Browser-specific push URL provided by PushManager.subscribe() */
  @Column({ unique: true })
  endpoint: string;

  /** Public encryption key (base64url) */
  @Column()
  p256dh: string;

  /** Auth secret (base64url) */
  @Column()
  auth: string;

  /** User-Agent stored for debugging stale/dead subscriptions */
  @Column({ nullable: true })
  userAgent: string;
}
