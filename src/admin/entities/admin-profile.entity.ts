import { Entity, Column, OneToOne, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { User } from '../../users/entities/user.entity';
import { AdminRole } from './admin-role.entity';
import type { ModulePermissionsMap } from './admin-role.entity';

@Entity('admin_profiles')
export class AdminProfile extends BaseEntity {
  @Column()
  userId: string;

  @Column({ default: false })
  isSuper: boolean;

  @Column({ nullable: true })
  roleId: string | null;

  @Column({ type: 'jsonb', default: {} })
  modulePermissions: ModulePermissionsMap;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  createdById: string | null;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => AdminRole, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'roleId' })
  role: AdminRole | null;

  @ManyToOne(() => AdminProfile, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'createdById' })
  createdBy: AdminProfile | null;
}
