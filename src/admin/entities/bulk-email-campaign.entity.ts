import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { AdminProfile } from './admin-profile.entity';

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
    enum: Object.values(CampaignTargetAudience),
    default: CampaignTargetAudience.ALL,
  })
  targetAudience: CampaignTargetAudience;

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
