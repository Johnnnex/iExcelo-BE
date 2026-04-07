import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SubscriptionPlan, PlanPrice } from '../entities';
import { LoggerService } from '../../logger/logger.service';
import { Currency, LogActionTypes } from '../../../types';

@Injectable()
export class SubscriptionPlansService {
  constructor(
    @InjectRepository(SubscriptionPlan)
    private planRepo: Repository<SubscriptionPlan>,
    @InjectRepository(PlanPrice)
    private planPriceRepo: Repository<PlanPrice>,
    private loggerService: LoggerService,
  ) {}

  /**
   * Create a new subscription plan (Admin)
   */
  async create(data: {
    examTypeId: string;
    name: string;
    description?: string;
    durationDays: number;
    sortOrder?: number;
    prices?: Array<{
      currency: Currency;
      amount: number;
      stripePriceId?: string;
      paystackPlanCode?: string;
    }>;
  }): Promise<SubscriptionPlan> {
    const plan = this.planRepo.create({
      examTypeId: data.examTypeId,
      name: data.name,
      description: data.description,
      durationDays: data.durationDays,
      sortOrder: data.sortOrder || 0,
      isActive: true,
    });

    const savedPlan = await this.planRepo.save(plan);

    // Create price records if provided
    if (data.prices && data.prices.length > 0) {
      const priceRecords = data.prices.map((price) =>
        this.planPriceRepo.create({
          planId: savedPlan.id,
          currency: price.currency,
          amount: price.amount,
          stripePriceId: price.stripePriceId,
          paystackPlanCode: price.paystackPlanCode,
          isActive: true,
        }),
      );
      await this.planPriceRepo.save(priceRecords);
    }

    await this.loggerService.log({
      action: LogActionTypes.CREATE,
      description: 'Subscription plan created',
      metadata: { planId: savedPlan.id, name: data.name },
    });

    return this.findOne(savedPlan.id);
  }

  /**
   * Find all plans with optional filters
   */
  async findAll(filters?: {
    examTypeId?: string;
    isActive?: boolean;
  }): Promise<SubscriptionPlan[]> {
    const where: { examTypeId?: string; isActive?: boolean } = {};

    if (filters?.examTypeId) {
      where.examTypeId = filters.examTypeId;
    }
    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    return this.planRepo.find({
      where,
      relations: ['prices', 'examType'],
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  /**
   * Find plan by ID
   */
  async findOne(id: string): Promise<SubscriptionPlan> {
    const plan = await this.planRepo.findOne({
      where: { id },
      relations: ['prices', 'examType'],
    });

    if (!plan) {
      throw new NotFoundException('Subscription plan not found');
    }

    return plan;
  }

  /**
   * Find active plans by exam type
   */
  async findByExamType(examTypeId: string): Promise<SubscriptionPlan[]> {
    return this.planRepo.find({
      where: { examTypeId, isActive: true },
      relations: ['prices'],
      order: { sortOrder: 'ASC' },
    });
  }

  /**
   * Update a subscription plan (Admin)
   */
  async update(
    id: string,
    data: {
      name?: string;
      description?: string;
      durationDays?: number;
      sortOrder?: number;
      isActive?: boolean;
    },
  ): Promise<SubscriptionPlan> {
    const plan = await this.findOne(id);

    Object.assign(plan, data);
    await this.planRepo.save(plan);

    await this.loggerService.log({
      action: LogActionTypes.UPDATE,
      description: 'Subscription plan updated',
      metadata: { planId: id, changes: data },
    });

    return this.findOne(id);
  }

  /**
   * Update or create a price for a plan
   */
  async upsertPrice(
    planId: string,
    data: {
      currency: Currency;
      amount: number;
      stripePriceId?: string;
      paystackPlanCode?: string;
    },
  ): Promise<PlanPrice> {
    // Verify plan exists
    await this.findOne(planId);

    let price = await this.planPriceRepo.findOne({
      where: { planId, currency: data.currency },
    });

    if (price) {
      Object.assign(price, data);
    } else {
      price = this.planPriceRepo.create({
        planId,
        ...data,
        isActive: true,
      });
    }

    return this.planPriceRepo.save(price);
  }

  /**
   * Deactivate a plan (soft delete)
   */
  async deactivate(id: string): Promise<void> {
    const plan = await this.findOne(id);
    plan.isActive = false;
    await this.planRepo.save(plan);

    await this.loggerService.log({
      action: LogActionTypes.UPDATE,
      description: 'Subscription plan deactivated',
      metadata: { planId: id },
    });
  }

  /**
   * Delete a plan (hard delete - only if no subscriptions)
   */
  async delete(id: string): Promise<void> {
    const plan = await this.planRepo.findOne({
      where: { id },
      relations: ['subscriptions'],
    });

    if (!plan) {
      throw new NotFoundException('Subscription plan not found');
    }

    if (plan.subscriptions && plan.subscriptions.length > 0) {
      throw new BadRequestException(
        'Cannot delete plan with existing subscriptions. Deactivate instead.',
      );
    }

    // Delete prices first
    await this.planPriceRepo.delete({ planId: id });

    // Delete plan
    await this.planRepo.delete(id);

    await this.loggerService.log({
      action: LogActionTypes.DELETE,
      description: 'Subscription plan deleted',
      metadata: { planId: id, name: plan.name },
    });
  }
}
