import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { Chatroom } from './chatroom.entity';
import { User } from '../../users/entities/user.entity';
import { ChatDeliveryStatus } from '../../../types';

@Entity('chat_messages')
@Index(['chatroomId', 'createdAt']) // hot query: paginate messages in a room
export class ChatMessage {
  @PrimaryColumn('uuid')
  id: string;

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = uuidv7();
    }
  }

  /** timestamptz: chat times cross timezone boundaries (sender ↔ recipient) */
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @Column()
  chatroomId: string;

  @Column()
  senderId: string;

  /** Markdown string (TipTap output) */
  @Column({ type: 'text' })
  content: string;

  @Column({
    type: 'enum',
    enum: Object.values(ChatDeliveryStatus),
    default: ChatDeliveryStatus.SENT,
  })
  deliveryStatus: ChatDeliveryStatus;

  /** Soft-delete placeholder — actual delete/edit reserved for v2 */
  @Column({ type: 'timestamp', nullable: true })
  deletedAt: Date | null;

  @Column({ default: false })
  isFlagged: boolean;

  @Column({ type: 'text', nullable: true })
  flagReason: string | null;

  @ManyToOne(() => Chatroom, (c) => c.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'chatroomId' })
  chatroom: Chatroom;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'senderId' })
  sender: User;
}
