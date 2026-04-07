import { Entity, Column, OneToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { User } from '../../users/entities/user.entity';

@Entity('user_presence')
export class UserPresence extends BaseEntity {
  /** userId is also the logical PK (unique) but we inherit UUID id from BaseEntity */
  @Column({ unique: true })
  userId: string;

  @Column({ default: false })
  isOnline: boolean;

  @Column({ type: 'timestamp', nullable: true })
  lastSeenAt: Date | null;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;
}
