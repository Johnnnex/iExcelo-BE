import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { AdminRole } from './admin-role.entity';
import type { ModulePermissionsMap } from './admin-role.entity';
import { AdminProfile } from './admin-profile.entity';

export enum AdminInviteStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  EXPIRED = 'expired',
}

@Entity('admin_invites')
@Index(['token'], { unique: true })
@Index(['email'])
export class AdminInvite extends BaseEntity {
  @Column()
  email: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column()
  token: string;

  @Column({
    type: 'enum',
    enum: Object.values(AdminInviteStatus),
    default: AdminInviteStatus.PENDING,
  })
  status: AdminInviteStatus;

  @Column({ nullable: true })
  roleId: string | null;

  @Column({ type: 'jsonb', default: {} })
  modulePermissions: ModulePermissionsMap;

  @Column()
  createdById: string;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  acceptedAt: Date | null;

  @ManyToOne(() => AdminRole, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'roleId' })
  role: AdminRole | null;

  @ManyToOne(() => AdminProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'createdById' })
  createdBy: AdminProfile;
}
