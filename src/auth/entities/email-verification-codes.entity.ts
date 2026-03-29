import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { BaseEntity } from '../../common/entities';

@Entity('email_verification_codes')
@Index(['code'])
@Index(['userId'])
export class EmailVerificationCode extends BaseEntity {
  @Column({ type: 'text' })
  code: string; // 6-digit verification code

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
