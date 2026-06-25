import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { AdminProfile } from './admin-profile.entity';

export enum CampaignCategory {
  NEWSLETTER = 'newsletter',
  PROMOTIONS = 'promotions',
  PRODUCT_UPDATES = 'product_updates',
  SECURITY_ALERTS = 'security_alerts',
}

export enum CampaignAudience {
  ALL = 'all',
  STUDENTS = 'students',
  SPONSORS = 'sponsors',
  AFFILIATES = 'affiliates',
}

/** @deprecated kept for migration compatibility — use targetAudiences array */
export enum CampaignTargetAudience {
  ALL = 'all',
  STUDENTS = 'students',
  SPONSORS = 'sponsors',
  AFFILIATES = 'affiliates',
}

export enum CampaignStatus {
  DRAFT = 'draft',
  QUEUED = 'queued',
  SENT = 'sent',
  FAILED = 'failed',
}

@Entity('bulk_email_campaigns')
@Index(['status'])
export class BulkEmailCampaign extends BaseEntity {
  @Column()
  name: string;

  @Column()
  subject: string;

  @Column({ type: 'text' })
  content: string;

  @Column({
    type: 'enum',
    enum: Object.values(CampaignCategory),
    default: CampaignCategory.NEWSLETTER,
  })
  category: CampaignCategory;

  @Column({
    type: 'simple-array',
    default: 'all',
  })
  targetAudiences: string[];

  @Column({
    type: 'enum',
    enum: Object.values(CampaignStatus),
    default: CampaignStatus.DRAFT,
  })
  status: CampaignStatus;

  @Column({ type: 'int', default: 0 })
  recipientCount: number;

  @Column({ type: 'timestamptz', nullable: true })
  sentAt: Date | null;

  @Column()
  createdById: string;

  @ManyToOne(() => AdminProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'createdById' })
  createdBy: AdminProfile;
}
