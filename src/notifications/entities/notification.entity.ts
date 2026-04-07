import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
  Index,
} from 'typeorm';
import { v7 as uuidv7 } from 'uuid';

export enum NotificationType {
  NEW_MESSAGE = 'new_message',
  NEW_CHATROOM = 'new_chatroom', // sponsor started a chat with student
  GIVEBACK_ACTIVATED = 'giveback_activated',
  SUBSCRIPTION_EXPIRING = 'subscription_expiring',
  SUBSCRIPTION_EXPIRED = 'subscription_expired',
  EXAM_RESULT = 'exam_result',
  FLAGGED_MESSAGE_REVIEWED = 'flagged_message_reviewed',
}

@Entity('notifications')
@Index(['recipientId', 'isRead', 'createdAt']) // common query: unread for userId
export class Notification {
  @PrimaryColumn('uuid')
  id: string;

  /** timestamptz: notification time is another user's action shown in recipient's POV */
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = uuidv7();
    }
  }

  @Column()
  recipientId: string;

  @Column({ type: 'enum', enum: Object.values(NotificationType) })
  type: NotificationType;

  /** Short heading shown in the notification panel */
  @Column()
  title: string;

  /** Preview text (truncated message content, or event description) */
  @Column({ type: 'text' })
  body: string;

  /**
   * Where to navigate when the notification is clicked.
   * Examples: /sponsor/messages/abc123  |  /sponsor/students  |  /student/dashboard
   */
  @Column()
  url: string;

  @Column({ default: false })
  isRead: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  readAt: Date | null;

  /**
   * Arbitrary extra data for client-side use (e.g. chatroomId, senderId).
   * Typed as JSON so consumers can extend it without schema changes.
   */
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;
}
