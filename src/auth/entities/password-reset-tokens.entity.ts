import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { BaseEntity } from '../../common/entities';

@Entity('password_reset_tokens')
@Index(['token'])
@Index(['userId'])
export class PasswordResetToken extends BaseEntity {
  @Column({ type: 'text' })
  token: string; // Hashed token

  @Column()
  userId: string;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({ default: false })
  used: boolean;

  // Relations
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;
}
