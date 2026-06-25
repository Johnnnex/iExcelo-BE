import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  BeforeInsert,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { BaseEntity } from '../../common/entities';

export enum VerificationCodePurpose {
  EMAIL_VERIFICATION = 'email_verification',
  SET_PASSWORD = 'set_password',
}

@Entity('email_verification_codes')
@Index(['code'])
@Index(['userId'])
export class EmailVerificationCode extends BaseEntity {
  @Column({ type: 'text' })
  code: string; // 6-digit verification code

  @Column()
  userId: string;

  @Column({
    type: 'varchar',
    default: VerificationCodePurpose.EMAIL_VERIFICATION,
  })
  purpose: VerificationCodePurpose;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({ default: false })
  used: boolean;

  // How many emails have been sent for this code (1 = initial send, incremented on each resend)
  @Column({ default: 1 })
  sentCount: number;

  // When the last email for this code was sent (used to compute resend cooldown)
  @Column({ type: 'timestamp', nullable: true })
  lastSentAt: Date;

  @BeforeInsert()
  initLastSentAt() {
    if (!this.lastSentAt) this.lastSentAt = new Date();
  }

  // Relations
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;
}
