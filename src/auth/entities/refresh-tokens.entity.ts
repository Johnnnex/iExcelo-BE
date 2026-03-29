import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { BaseEntity } from '../../common/entities';

@Entity('refresh_tokens')
@Index(['token'])
@Index(['userId'])
export class RefreshToken extends BaseEntity {
  @Column({ type: 'text' })
  token: string; // Hashed refresh token

  @Column()
  userId: string;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({ default: false })
  revoked: boolean;

  @Column({ nullable: true })
  userAgent: string; // Track device

  @Column({ nullable: true })
  ipAddress: string; // Track location

  @Column({ nullable: true })
  familyId: string; // For token rotation detection

  // Relations
  @ManyToOne(() => User, (user) => user.refreshTokens, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;
}
