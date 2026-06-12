import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { SubscriptionPlan } from '../subscriptions/entities/subscription-plan.entity';
import { SubscriptionStatus } from '../../types';

@Injectable()
export class AdminSubscriptionsService {
  constructor(
    @InjectRepository(Subscription)
    private subscriptionRepo: Repository<Subscription>,
    @InjectRepository(SubscriptionPlan)
    private planRepo: Repository<SubscriptionPlan>,
  ) {}

  // ─── Subscriptions (cursor-based) ──────────────────────────────────────────

  async listSubscriptions(opts: {
    limit: number;
    type?: 'student' | 'sponsor';
    status?: string;
    examTypeId?: string;
    search?: string;
    cursor?: string;
  }) {
    const { limit, type, status, examTypeId, search, cursor } = opts;

    const qb = this.subscriptionRepo
      .createQueryBuilder('sub')
      .leftJoinAndSelect('sub.student', 'sp')
      .leftJoinAndSelect('sp.user', 'u')
      .leftJoinAndSelect('sub.sponsor', 'spon')
      .leftJoinAndSelect('spon.user', 'sponu')
      .leftJoinAndSelect('sub.examType', 'et')
      .leftJoinAndSelect('sub.plan', 'pl')
      .orderBy('sub.createdAt', 'DESC')
      .addOrderBy('sub.id', 'DESC')
      .take(limit + 1);

    if (cursor) {
      qb.andWhere(
        `(sub.createdAt < :cur OR (sub.createdAt = :cur AND sub.id < :curId))`,
        { cur: new Date(cursor.split('__')[0]), curId: cursor.split('__')[1] ?? '' },
      );
    }

    if (type === 'student') {
      qb.andWhere('sub.sponsorId IS NULL');
    } else if (type === 'sponsor') {
      qb.andWhere('sub.sponsorId IS NOT NULL');
    }

    if (status) {
      qb.andWhere('sub.status = :status', { status });
    }
    if (examTypeId) {
      qb.andWhere('sub.examTypeId = :examTypeId', { examTypeId });
    }
    if (search) {
      qb.andWhere(
        '(u.firstName ILIKE :s OR u.lastName ILIKE :s OR u.email ILIKE :s)',
        { s: `%${search}%` },
      );
    }

    const items = await qb.getMany();
    const hasMore = items.length > limit;
    if (hasMore) items.pop();

    const last = items[items.length - 1];
    const nextCursor = hasMore && last
      ? `${last.createdAt.toISOString()}__${last.id}`
      : null;

    return { items, nextCursor, hasMore };
  }

  async overrideStatus(id: string, status: SubscriptionStatus, endDate?: Date) {
    const sub = await this.subscriptionRepo.findOne({ where: { id } });
    if (!sub) throw new NotFoundException('Subscription not found');

    sub.status = status;
    if (status === SubscriptionStatus.CANCELLED) {
      sub.cancelledAt = new Date();
    }
    if (endDate) {
      sub.endDate = endDate;
    }
    await this.subscriptionRepo.save(sub);
    return { message: 'Status updated' };
  }

  async cancelSubscription(id: string) {
    const sub = await this.subscriptionRepo.findOne({ where: { id } });
    if (!sub) throw new NotFoundException('Subscription not found');
    if (sub.status === SubscriptionStatus.CANCELLED) {
      throw new BadRequestException('Already cancelled');
    }
    sub.status = SubscriptionStatus.CANCELLED;
    sub.cancelledAt = new Date();
    await this.subscriptionRepo.save(sub);
    return { message: 'Subscription cancelled' };
  }

  // ─── Plans ─────────────────────────────────────────────────────────────────

  async listPlans() {
    return this.planRepo.find({
      relations: ['examType'],
      order: { examTypeId: 'ASC', sortOrder: 'ASC', durationDays: 'ASC' },
    });
  }

  async createPlan(data: {
    examTypeId: string;
    name: string;
    description?: string;
    durationDays: number;
    sortOrder?: number;
    stripeProductId?: string;
  }) {
    const plan = this.planRepo.create({
      ...data,
      isActive: true,
      sortOrder: data.sortOrder ?? 0,
    });
    return this.planRepo.save(plan);
  }

  async updatePlan(id: string, data: {
    name?: string;
    description?: string;
    durationDays?: number;
    sortOrder?: number;
    stripeProductId?: string;
    isActive?: boolean;
  }) {
    const plan = await this.planRepo.findOne({ where: { id } });
    if (!plan) throw new NotFoundException('Plan not found');
    Object.assign(plan, data);
    return this.planRepo.save(plan);
  }

  async deletePlan(id: string) {
    const plan = await this.planRepo.findOne({ where: { id } });
    if (!plan) throw new NotFoundException('Plan not found');
    await this.planRepo.remove(plan);
    return { message: 'Plan deleted' };
  }
}
