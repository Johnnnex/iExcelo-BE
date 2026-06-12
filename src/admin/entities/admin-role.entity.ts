import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities';

export enum AdminModule {
  ADMIN_MANAGEMENT = 'admin_management',
  EXAM_REVISION = 'exam_revision',
  STUDENTS = 'students',
  SPONSORS = 'sponsors',
  AFFILIATES = 'affiliates',
  SUBSCRIPTIONS = 'subscriptions',
  TESTIMONIALS = 'testimonials',
  BULK_EMAILS = 'bulk_emails',
  ANALYTICS = 'analytics',
  MESSAGES = 'messages',
}

export interface ModulePermission {
  canRead: boolean;
  canWrite: boolean;
}

export type ModulePermissionsMap = Partial<
  Record<AdminModule, ModulePermission>
>;

@Entity('admin_roles')
@Index(['name'], { unique: true })
export class AdminRole extends BaseEntity {
  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'jsonb', default: {} })
  modules: ModulePermissionsMap;

  @Column({ nullable: true })
  createdById: string | null;

  @ManyToOne('AdminProfile', { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'createdById' })
  createdBy: unknown;
}
