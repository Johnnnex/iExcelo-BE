import { Entity, Column, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { Chatroom } from './chatroom.entity';
import { User } from '../../users/entities/user.entity';

@Entity('chatroom_participants')
@Unique(['chatroomId', 'userId'])
@Index(['userId']) // fast lookup: all chatrooms a user is in
export class ChatroomParticipant extends BaseEntity {
  @Column()
  chatroomId: string;

  @Column()
  userId: string;

  /**
   * High-water mark: every message with createdAt <= lastReadAt is considered
   * read by this participant. Used to compute unread counts without per-message
   * receipt rows.
   */
  @Column({ type: 'timestamptz', nullable: true })
  lastReadAt: Date | null;

  @ManyToOne(() => Chatroom, (c) => c.participants, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'chatroomId' })
  chatroom: Chatroom;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;
}
