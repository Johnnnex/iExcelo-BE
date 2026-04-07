import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { ChatMessage } from './chat-message.entity';
import { Chatroom } from './chatroom.entity';
import { User } from '../../users/entities/user.entity';

export enum FlagStatus {
  PENDING = 'pending',
  REVIEWED = 'reviewed',
  DISMISSED = 'dismissed',
}

/**
 * Admin-facing review record created whenever a participant flags a message.
 * Decoupled from the boolean on ChatMessage so admins get a proper workflow
 * (pending → reviewed / dismissed) with optional notes and full audit trail.
 */
@Entity('message_flags')
@Index(['status']) // admin dashboard filters by status
export class MessageFlag extends BaseEntity {
  @Column()
  messageId: string;

  /** Denormalised for admin convenience — they can query the full chatroom */
  @Column()
  chatroomId: string;

  @Column()
  reportedByUserId: string;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({
    type: 'enum',
    enum: Object.values(FlagStatus),
    default: FlagStatus.PENDING,
  })
  status: FlagStatus;

  /** Admin can leave notes when reviewing */
  @Column({ type: 'text', nullable: true })
  adminNotes: string | null;

  @Column({ nullable: true })
  reviewedByAdminId: string;

  @Column({ type: 'timestamp', nullable: true })
  reviewedAt: Date | null;

  @ManyToOne(() => ChatMessage, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'messageId' })
  message: ChatMessage;

  @ManyToOne(() => Chatroom, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'chatroomId' })
  chatroom: Chatroom;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reportedByUserId' })
  reportedBy: User;
}
