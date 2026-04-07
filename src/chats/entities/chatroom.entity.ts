import { Entity, Column, OneToMany, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { ChatroomType } from '../../../types';
import { ChatroomParticipant } from './chatroom-participant.entity';
import { ChatMessage } from './chat-message.entity';

@Entity('chatrooms')
@Index(['createdAt'])
export class Chatroom extends BaseEntity {
  @Column({
    type: 'enum',
    enum: Object.values(ChatroomType),
    default: ChatroomType.SPONSOR_STUDENT,
  })
  type: ChatroomType;

  @OneToMany(() => ChatroomParticipant, (p) => p.chatroom, { cascade: true })
  participants: ChatroomParticipant[];

  @OneToMany(() => ChatMessage, (m) => m.chatroom)
  messages: ChatMessage[];
}
