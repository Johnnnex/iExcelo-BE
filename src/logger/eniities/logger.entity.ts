import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { LogActionTypes, LogSeverity } from '../../../types';
import { BaseEntity } from '../../common/entities';

@Entity('activity_logs')
export class ActivityLog extends BaseEntity {
  @Column({ nullable: true })
  userId: string; // Nullable for system logs

  @Column({
    type: 'enum',
    enum: Object.values(LogActionTypes),
  })
  action: LogActionTypes;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'json', nullable: true })
  metadata: any; // IP, request details, etc.

  @Column({
    type: 'enum',
    enum: Object.values(LogSeverity),
    default: LogSeverity.INFO,
  })
  severity: LogSeverity;

  // Relations
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'userId' })
  user: User;
}
