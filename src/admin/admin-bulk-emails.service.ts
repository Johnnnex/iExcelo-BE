import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import {
  BulkEmailCampaign,
  CampaignCategory,
  CampaignStatus,
} from './entities/bulk-email-campaign.entity';
import { AdminProfile } from './entities/admin-profile.entity';
import { User } from '../users/entities/user.entity';
import { EMAILS_QUEUE, EmailJobs } from '../email/queue/email.queue';
import { UserType } from '../../types';

export interface CampaignDto {
  name: string;
  subject: string;
  content: string;
  category: CampaignCategory;
  targetAudiences: string[];
}

/** Map category → user opt-in column name */
const CATEGORY_OPT_IN_COLUMN: Record<CampaignCategory, keyof User | null> = {
  [CampaignCategory.NEWSLETTER]: 'newsletterOptIn',
  [CampaignCategory.PROMOTIONS]: 'promotionsOptIn',
  [CampaignCategory.PRODUCT_UPDATES]: 'productUpdatesOptIn',
  [CampaignCategory.SECURITY_ALERTS]: 'securityAlertsOptIn',
};

@Injectable()
export class AdminBulkEmailsService {
  constructor(
    @InjectRepository(BulkEmailCampaign)
    private campaignRepo: Repository<BulkEmailCampaign>,
    @InjectRepository(AdminProfile)
    private adminProfileRepo: Repository<AdminProfile>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectQueue(EMAILS_QUEUE)
    private emailQueue: Queue,
  ) {}

  listCampaigns(page = 1, limit = 20) {
    return this.campaignRepo.find({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
      relations: ['createdBy'],
    });
  }

  async createCampaign(dto: CampaignDto, adminUserId: string) {
    const profile = await this.adminProfileRepo.findOne({
      where: { userId: adminUserId },
    });
    if (!profile) throw new NotFoundException('Admin profile not found');

    const campaign = this.campaignRepo.create({
      name: dto.name,
      subject: dto.subject,
      content: dto.content,
      category: dto.category,
      targetAudiences: dto.targetAudiences?.length
        ? dto.targetAudiences
        : ['all'],
      status: CampaignStatus.DRAFT,
      createdById: profile.id,
    });
    return this.campaignRepo.save(campaign);
  }

  async updateCampaign(id: string, dto: Partial<CampaignDto>) {
    const campaign = await this.campaignRepo.findOne({ where: { id } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.status !== CampaignStatus.DRAFT) {
      throw new BadRequestException('Only draft campaigns can be edited');
    }
    if (dto.targetAudiences !== undefined && !dto.targetAudiences.length) {
      dto.targetAudiences = ['all'];
    }
    Object.assign(campaign, dto);
    return this.campaignRepo.save(campaign);
  }

  async deleteCampaign(id: string) {
    const campaign = await this.campaignRepo.findOne({ where: { id } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.status !== CampaignStatus.DRAFT) {
      throw new BadRequestException('Only draft campaigns can be deleted');
    }
    await this.campaignRepo.remove(campaign);
    return { message: 'Deleted' };
  }

  async sendCampaign(id: string) {
    const campaign = await this.campaignRepo.findOne({ where: { id } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.status !== CampaignStatus.DRAFT) {
      throw new BadRequestException('Campaign has already been sent or queued');
    }

    const users = await this.getTargetUsers(
      campaign.targetAudiences,
      campaign.category,
    );

    campaign.status = CampaignStatus.QUEUED;
    campaign.recipientCount = users.length;
    await this.campaignRepo.save(campaign);

    const jobs = users.map((user) => ({
      name: EmailJobs.SEND_BULK_CAMPAIGN,
      data: {
        email: user.email,
        firstName: user.firstName,
        subject: campaign.subject,
        htmlContent: campaign.content,
        category: campaign.category,
      },
    }));

    await this.emailQueue.addBulk(jobs);

    campaign.status = CampaignStatus.SENT;
    campaign.sentAt = new Date();
    await this.campaignRepo.save(campaign);

    return { message: 'Campaign sent', recipientCount: users.length };
  }

  private getTargetUsers(
    audiences: string[],
    category: CampaignCategory,
  ): Promise<User[]> {
    const qb = this.userRepo
      .createQueryBuilder('u')
      .select(['u.id', 'u.email', 'u.firstName'])
      .where('u.isActive = true')
      .andWhere('u.emailVerified = true');

    // Filter by subscription opt-in for this category
    const optInColumn = CATEGORY_OPT_IN_COLUMN[category];
    if (optInColumn) {
      qb.andWhere(`u.${optInColumn} = true`);
    }

    // Filter by role(s) — 'all' means no role filter
    const rolesMap: Record<string, UserType> = {
      students: UserType.STUDENT,
      sponsors: UserType.SPONSOR,
      affiliates: UserType.AFFILIATE,
    };
    const targetRoles = audiences
      .filter((a) => a !== 'all')
      .map((a) => rolesMap[a])
      .filter(Boolean);

    if (targetRoles.length > 0) {
      qb.andWhere('u.role IN (:...roles)', { roles: targetRoles });
    }

    return qb.getMany();
  }
}
