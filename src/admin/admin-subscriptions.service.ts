import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { SubscriptionPlan } from '../subscriptions/entities/subscription-plan.entity';
import { PlanPrice } from '../subscriptions/entities/plan-price.entity';
import { PlanPriceProvider } from '../subscriptions/entities/plan-price-provider.entity';
import { RegionCurrency } from '../subscriptions/entities/region-currency.entity';
import { Currency, PaymentProvider, SubscriptionStatus } from '../../types';

@Injectable()
export class AdminSubscriptionsService {
  constructor(
    @InjectRepository(Subscription)
    private subscriptionRepo: Repository<Subscription>,
    @InjectRepository(SubscriptionPlan)
    private planRepo: Repository<SubscriptionPlan>,
    @InjectRepository(PlanPrice)
    private priceRepo: Repository<PlanPrice>,
    @InjectRepository(PlanPriceProvider)
    private planPriceProviderRepo: Repository<PlanPriceProvider>,
    @InjectRepository(RegionCurrency)
    private regionCurrencyRepo: Repository<RegionCurrency>,
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
        {
          cur: new Date(cursor.split('__')[0]),
          curId: cursor.split('__')[1] ?? '',
        },
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
    const nextCursor =
      hasMore && last ? `${last.createdAt.toISOString()}__${last.id}` : null;

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
      relations: ['examType', 'prices', 'prices.providers'],
      order: { examTypeId: 'ASC', sortOrder: 'ASC', durationDays: 'ASC' },
    });
  }

  private async upsertPrices(
    planId: string,
    prices: Array<{
      currency: string;
      amount: number;
    }>,
  ) {
    for (const p of prices) {
      const existing = await this.priceRepo.findOne({
        where: { planId, currency: p.currency as Currency },
      });
      if (existing) {
        existing.amount = p.amount;
        await this.priceRepo.save(existing);
      } else {
        await this.priceRepo.save(
          this.priceRepo.create({
            planId,
            currency: p.currency as Currency,
            amount: p.amount,
            isActive: true,
          }),
        );
      }
    }
  }

  async createPlan(data: {
    examTypeId: string;
    name: string;
    description?: string;
    durationDays: number;
    sortOrder?: number;
    prices?: Array<{
      currency: string;
      amount: number;
    }>;
  }) {
    const nameConflict = await this.planRepo
      .createQueryBuilder('p')
      .where('LOWER(p.name) = LOWER(:name)', { name: data.name })
      .andWhere('p.examTypeId = :examTypeId', { examTypeId: data.examTypeId })
      .getOne();
    if (nameConflict)
      throw new ConflictException(
        'A plan with this name already exists for this exam type',
      );

    const { prices, ...planData } = data;
    const plan = await this.planRepo.save(
      this.planRepo.create({
        ...planData,
        isActive: true,
        sortOrder: planData.sortOrder ?? 0,
      }),
    );
    if (prices?.length) await this.upsertPrices(plan.id, prices);
    return this.planRepo.findOne({
      where: { id: plan.id },
      relations: ['examType', 'prices', 'prices.providers'],
    });
  }

  async updatePlan(
    id: string,
    data: {
      name?: string;
      description?: string;
      durationDays?: number;
      sortOrder?: number;
      isActive?: boolean;
      prices?: Array<{
        currency: string;
        amount: number;
      }>;
    },
  ) {
    const plan = await this.planRepo.findOne({ where: { id } });
    if (!plan) throw new NotFoundException('Plan not found');

    if (data.name) {
      const nameConflict = await this.planRepo
        .createQueryBuilder('p')
        .where('LOWER(p.name) = LOWER(:name)', { name: data.name })
        .andWhere('p.examTypeId = :examTypeId', { examTypeId: plan.examTypeId })
        .andWhere('p.id != :id', { id })
        .getOne();
      if (nameConflict)
        throw new ConflictException(
          'A plan with this name already exists for this exam type',
        );
    }

    const { prices, ...planData } = data;
    Object.assign(plan, planData);
    await this.planRepo.save(plan);
    if (prices?.length) await this.upsertPrices(id, prices);
    return this.planRepo.findOne({
      where: { id },
      relations: ['examType', 'prices', 'prices.providers'],
    });
  }

  async deletePlan(id: string) {
    const plan = await this.planRepo.findOne({ where: { id } });
    if (!plan) throw new NotFoundException('Plan not found');
    await this.planRepo.remove(plan);
    return { message: 'Plan deleted' };
  }

  // ─── Plan Price Providers ───────────────────────────────────────────────────

  async listPlanPriceProviders(planPriceId: string) {
    return this.planPriceProviderRepo.find({
      where: { planPriceId },
      order: { provider: 'ASC' },
    });
  }

  async upsertPlanPriceProvider(data: {
    planPriceId: string;
    provider: string;
    stripePriceId?: string | null;
    paystackPlanCode?: string | null;
    isActive?: boolean;
  }) {
    const price = await this.priceRepo.findOne({
      where: { id: data.planPriceId },
    });
    if (!price) throw new NotFoundException('Plan price not found');

    // Validate no duplicate stripePriceId across the table
    if (data.stripePriceId) {
      const conflict = await this.planPriceProviderRepo
        .createQueryBuilder('ppp')
        .where('ppp.stripePriceId = :id', { id: data.stripePriceId })
        .andWhere('ppp.planPriceId != :planPriceId', {
          planPriceId: data.planPriceId,
        })
        .getOne();
      if (conflict)
        throw new ConflictException(
          `Stripe price ID "${data.stripePriceId}" is already in use`,
        );
    }

    if (data.paystackPlanCode) {
      const conflict = await this.planPriceProviderRepo
        .createQueryBuilder('ppp')
        .where('ppp.paystackPlanCode = :code', { code: data.paystackPlanCode })
        .andWhere('ppp.planPriceId != :planPriceId', {
          planPriceId: data.planPriceId,
        })
        .getOne();
      if (conflict)
        throw new ConflictException(
          `Paystack plan code "${data.paystackPlanCode}" is already in use`,
        );
    }

    const existing = await this.planPriceProviderRepo.findOne({
      where: {
        planPriceId: data.planPriceId,
        provider: data.provider as PaymentProvider,
      },
    });

    if (existing) {
      if (data.stripePriceId !== undefined)
        existing.stripePriceId = data.stripePriceId as string;
      if (data.paystackPlanCode !== undefined)
        existing.paystackPlanCode = data.paystackPlanCode as string;
      if (data.isActive !== undefined) existing.isActive = data.isActive;
      return this.planPriceProviderRepo.save(existing);
    }

    return this.planPriceProviderRepo.save(
      this.planPriceProviderRepo.create({
        planPriceId: data.planPriceId,
        provider: data.provider as PaymentProvider,
        stripePriceId: data.stripePriceId as string,
        paystackPlanCode: data.paystackPlanCode as string,
        isActive: data.isActive ?? true,
      }),
    );
  }

  async deletePlanPriceProvider(id: string) {
    const ppp = await this.planPriceProviderRepo.findOne({ where: { id } });
    if (!ppp) throw new NotFoundException('Provider config not found');
    await this.planPriceProviderRepo.remove(ppp);
    return { message: 'Provider removed' };
  }

  // ─── Region Currencies ─────────────────────────────────────────────────────

  async listRegionCurrencies(opts: {
    page: number;
    limit: number;
    search?: string;
  }) {
    const qb = this.regionCurrencyRepo
      .createQueryBuilder('rc')
      .orderBy('rc.regionName', 'ASC')
      .skip((opts.page - 1) * opts.limit)
      .take(opts.limit);
    if (opts.search)
      qb.where('rc.regionName ILIKE :s OR rc.regionCode ILIKE :s', {
        s: `%${opts.search}%`,
      });
    const [items, total] = await qb.getManyAndCount();
    return { items, total, page: opts.page, limit: opts.limit };
  }

  async createRegionCurrency(data: {
    regionCode: string;
    regionName: string;
    currency: string;
    isActive?: boolean;
  }) {
    const existing = await this.regionCurrencyRepo.findOne({
      where: { regionCode: data.regionCode },
    });
    if (existing)
      throw new ConflictException(
        `Region code "${data.regionCode}" already exists`,
      );
    return this.regionCurrencyRepo.save(
      this.regionCurrencyRepo.create({
        regionCode: data.regionCode,
        regionName: data.regionName,
        currency: data.currency as Currency,
        isActive: data.isActive ?? true,
      }),
    );
  }

  async updateRegionCurrency(
    id: string,
    data: {
      regionName?: string;
      currency?: string;
      isActive?: boolean;
    },
  ) {
    const rc = await this.regionCurrencyRepo.findOne({ where: { id } });
    if (!rc) throw new NotFoundException('Region not found');
    if (data.regionName !== undefined) rc.regionName = data.regionName;
    if (data.currency !== undefined) rc.currency = data.currency as Currency;
    if (data.isActive !== undefined) rc.isActive = data.isActive;
    return this.regionCurrencyRepo.save(rc);
  }
}
