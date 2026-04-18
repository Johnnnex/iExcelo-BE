import {
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import {
  ANALYTICS_QUEUE,
  AnalyticsJobs,
} from '../analytics/queue/analytics.queue';
import { Repository, Not, LessThan, MoreThan, Between, In } from 'typeorm';
import {
  Subscription,
  SubscriptionPlan,
  Transaction,
  PlanPrice,
  RegionCurrency,
} from './entities';
import { User } from '../users/entities/user.entity';
import { StudentsService } from '../students/students.service';
import { ExamType } from '../exams/entities/exam-type.entity';
import { Giveback } from '../sponsors/entities/giveback.entity';
import { LoggerService } from '../logger/logger.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { AffiliatesService } from '../affiliates/affiliates.service';
import {
  regionsData,
  defaultRegion,
  plansData,
  planPricesData,
  paystackPlanCodes,
} from './data';
import {
  SubscriptionStatus,
  GivebackStatus,
  PaymentProvider,
  Currency,
  LogActionTypes,
  UserType,
} from '../../types';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    @InjectRepository(Subscription)
    private subscriptionRepo: Repository<Subscription>,
    @InjectRepository(SubscriptionPlan)
    private planRepo: Repository<SubscriptionPlan>,
    @InjectRepository(Transaction)
    private transactionRepo: Repository<Transaction>,
    @InjectRepository(PlanPrice)
    private planPriceRepo: Repository<PlanPrice>,
    @InjectRepository(RegionCurrency)
    private regionCurrencyRepo: Repository<RegionCurrency>,
    private configService: ConfigService,
    private loggerService: LoggerService,
    private analyticsService: AnalyticsService,
    @InjectQueue(ANALYTICS_QUEUE) private readonly analyticsQueue: Queue,
    private affiliatesService: AffiliatesService,
    @Inject(forwardRef(() => StudentsService))
    private readonly studentsService: StudentsService,
  ) {}

  /**
   * Force reseed all subscription plans and prices.
   * Clears existing plans (cascade deletes prices) and recreates from seed data.
   * Use this when seed data changes or DB is corrupted.
   */
  async forceReseedPlans(): Promise<{
    plansCreated: number;
    pricesCreated: number;
  }> {
    // Clear existing plans (prices cascade delete due to FK)
    await this.planPriceRepo.createQueryBuilder().delete().execute();
    await this.planRepo.createQueryBuilder().delete().execute();

    // Also reseed regions
    await this.regionCurrencyRepo.createQueryBuilder().delete().execute();

    const regions = regionsData.map((region) =>
      this.regionCurrencyRepo.create({ ...region, isActive: true }),
    );
    await this.regionCurrencyRepo.save(regions);

    const defaultRegionEntity = this.regionCurrencyRepo.create({
      ...defaultRegion,
      isActive: true,
    });
    await this.regionCurrencyRepo.save(defaultRegionEntity);

    return this.createPlansForAllExamTypes();
  }

  /**
   * Creates subscription plans and prices for all active exam types.
   * Returns count of created records.
   */
  private async createPlansForAllExamTypes(): Promise<{
    plansCreated: number;
    pricesCreated: number;
  }> {
    let plansCreated = 0;
    let pricesCreated = 0;

    // Get all exam types
    const examTypeRepo = this.subscriptionRepo.manager.getRepository(ExamType);
    const examTypes = await examTypeRepo.find({ where: { isActive: true } });

    if (examTypes.length === 0) {
      this.logger.warn(
        'No active exam types found - cannot seed subscription plans',
      );
      return { plansCreated: 0, pricesCreated: 0 };
    }

    // Create plans for each exam type
    for (const examType of examTypes) {
      // Look up per-exam-type Paystack plan codes
      const examPlanCodes = paystackPlanCodes[examType.name] || {};

      for (const planData of plansData) {
        const plan = this.planRepo.create({
          examTypeId: examType.id,
          name: planData.name,
          description: planData.description,
          durationDays: planData.durationDays,
          sortOrder: planData.sortOrder,
          isActive: true,
          stripeProductId: planData.stripeProductId,
        });
        const savedPlan = await this.planRepo.save(plan);
        plansCreated++;

        // Create prices for each currency with provider-specific IDs
        const priceIndex = planData.sortOrder - 1; // 0, 1, 2
        const currencies = Object.keys(planPricesData) as Currency[];
        for (const currency of currencies) {
          const priceData = planPricesData[currency][priceIndex];

          // Get exam-type-specific Paystack plan code for this currency + plan index
          const paystackCode =
            examPlanCodes[currency]?.[priceIndex] || undefined;

          const price = this.planPriceRepo.create({
            planId: savedPlan.id,
            currency,
            amount: priceData.amount,
            isActive: true,
            stripePriceId: priceData.stripePriceId,
            paystackPlanCode: paystackCode || priceData.paystackPlanCode,
          });
          await this.planPriceRepo.save(price);
          pricesCreated++;
        }
      }
    }

    this.logger.log(
      `Seeded ${plansCreated} subscription plans with ${pricesCreated} prices for ${examTypes.length} exam types`,
    );
    return { plansCreated, pricesCreated };
  }

  /**
   * Create a new subscription (called when initiating payment)
   */
  async createSubscription(data: {
    studentId: string;
    examTypeId: string;
    planId: string;
    planPriceId: string; // The specific price (currency-specific) being purchased
    sponsorId?: string;
    givebackId?: string; // Set when created as part of a sponsor giveback action
    provider: PaymentProvider;
    currency: Currency;
    amount: number;
    providerSubscriptionId?: string;
    providerCustomerId?: string;
  }): Promise<Subscription> {
    // StudentExamType is NOT created here — it's created in activateSubscription()
    // after payment succeeds, to avoid orphaned records on failed payments
    const subscription = this.subscriptionRepo.create({
      studentId: data.studentId,
      examTypeId: data.examTypeId,
      planId: data.planId,
      planPriceId: data.planPriceId,
      sponsorId: data.sponsorId,
      givebackId: data.givebackId ?? null,
      status: SubscriptionStatus.PENDING,
      paymentProvider: data.provider,
      currency: data.currency,
      amountPaid: data.amount,
      providerSubscriptionId: data.providerSubscriptionId,
      providerCustomerId: data.providerCustomerId,
      autoRenew: data.givebackId ? false : true,
    });

    return this.subscriptionRepo.save(subscription);
  }

  /**
   * Activate subscription and set isPaid = true on StudentExamType
   * Called when payment succeeds via webhook
   */
  async activateSubscription(subscriptionId: string): Promise<void> {
    const subscription = await this.subscriptionRepo.findOne({
      where: { id: subscriptionId },
      relations: ['plan', 'student'],
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    // Idempotent: if already active or scheduled, skip
    if (
      subscription.status === SubscriptionStatus.ACTIVE ||
      subscription.status === SubscriptionStatus.SCHEDULED
    ) {
      return;
    }

    // Stacking: check if there's already a live sub (ACTIVE or CANCELLED with future endDate)
    // for this student + examType. New sub starts the day after the existing one ends.
    const liveSub = await this.subscriptionRepo.findOne({
      where: [
        {
          studentId: subscription.studentId,
          examTypeId: subscription.examTypeId,
          status: SubscriptionStatus.ACTIVE,
          endDate: MoreThan(new Date()),
        },
        {
          studentId: subscription.studentId,
          examTypeId: subscription.examTypeId,
          status: SubscriptionStatus.CANCELLED,
          endDate: MoreThan(new Date()),
        },
      ],
      order: { endDate: 'DESC' },
    });

    if (liveSub?.endDate) {
      const startDate = new Date(liveSub.endDate);
      startDate.setDate(startDate.getDate() + 1);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + subscription.plan.durationDays);
      subscription.status = SubscriptionStatus.SCHEDULED;
      subscription.startDate = startDate;
      subscription.endDate = endDate;
      subscription.lastPaymentStatus = 'succeeded';
      await this.subscriptionRepo.save(subscription);
      return;
    }

    // Find or create StudentExamType (only created after payment succeeds)
    const studentExamType =
      await this.studentsService.findOrCreateStudentExamType(
        subscription.studentId,
        subscription.examTypeId,
      );

    // Calculate dates based on plan duration
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + subscription.plan.durationDays);

    // Update subscription status and link to StudentExamType
    subscription.status = SubscriptionStatus.ACTIVE;
    subscription.startDate = startDate;
    subscription.endDate = endDate;
    subscription.lastPaymentStatus = 'succeeded';
    subscription.studentExamTypeId = studentExamType.id;
    await this.subscriptionRepo.save(subscription);

    await this.studentsService.grantExamAccess(
      studentExamType.id,
      subscription.id,
    );

    // Log activation
    await this.loggerService.log({
      action: LogActionTypes.PAYMENT,
      description: 'Subscription activated',
      metadata: {
        subscriptionId: subscription.id,
        studentId: subscription.studentId,
        examTypeId: subscription.examTypeId,
        planId: subscription.planId,
      },
    });

    // Track platform analytics (queued — side effect, does not block activation response)
    await this.analyticsQueue.add(AnalyticsJobs.TRACK_PLATFORM, {
      data: {
        newSubscriptions: 1,
        totalRevenue: subscription.amountPaid,
        premiumUsers: 1,
      },
    });

    // Mark student as having ever subscribed (gates commission earning for student referrers)
    // Affiliate profile is now created eagerly at signup — no lazy creation needed here.
    if (subscription.student?.userId) {
      try {
        await this.studentsService.markStudentAsSubscribed(
          subscription.student.userId,
        );
      } catch {
        // Don't fail activation if student profile update fails
      }
    }

    // Affiliate commission — commission on every subscription payment (not just first)
    if (subscription.student?.userId && subscription.amountPaid > 0) {
      try {
        const referral = await this.affiliatesService.findReferralByUserId(
          subscription.student.userId,
        );
        if (referral) {
          // Check if the referring affiliate is NOT a sponsor (sponsors don't earn commissions)
          const affiliateProfile = await this.affiliatesService.findById(
            referral.affiliateId,
          );
          if (affiliateProfile) {
            const affiliateUser = await this.subscriptionRepo.manager
              .getRepository(User)
              .findOne({ where: { id: affiliateProfile.userId } });

            if (affiliateUser && affiliateUser.role !== UserType.SPONSOR) {
              // If affiliate is a student, they must have subscribed before to earn commissions
              let canEarn = true;
              if (affiliateUser.role === UserType.STUDENT) {
                canEarn = await this.studentsService.hasStudentEverSubscribed(
                  affiliateProfile.userId,
                );
              }

              if (canEarn) {
                // Commission creation (queued inline via promise — non-blocking, errors caught by outer try/catch)
                void this.affiliatesService
                  .createCommission({
                    affiliateId: referral.affiliateId,
                    referralId: referral.id,
                    subscriptionId: subscription.id,
                    subscriptionAmount: subscription.amountPaid,
                    currency: subscription.currency,
                    planName: subscription.plan?.name,
                  })
                  .catch(() => {
                    // Don't fail activation if commission creation fails
                  });
              }
            }
          }

          // Update referral stats regardless of commission (sponsors too)
          if (!referral.hasSubscribed) {
            // First subscription — mark referral as converted
            await this.affiliatesService.markReferralConverted(referral.id);
            // Increment static conversion counter
            await this.affiliatesService.incrementConversions(
              referral.affiliateId,
            );
            // Track affiliate analytics (queued — side effect)
            await this.analyticsQueue.add(AnalyticsJobs.TRACK_AFFILIATE_DAILY, {
              affiliateId: referral.affiliateId,
              data: { conversions: 1 },
            });
          }
        }
      } catch {
        // Don't fail activation if commission creation fails
      }
    }
  }

  /**
   * Handle subscription failure/cancellation - set isPaid = false
   */
  async deactivateSubscription(
    subscriptionId: string,
    reason: 'cancelled' | 'expired' | 'payment_failed',
  ): Promise<void> {
    const subscription = await this.subscriptionRepo.findOne({
      where: { id: subscriptionId },
    });

    if (!subscription) return;

    // Update subscription status based on reason
    switch (reason) {
      case 'cancelled':
        // Student cancelled: keep isPaid=true, they enjoy until endDate.
        // reconcileStudentSub handles expiry + isPaid=false when endDate passes.
        subscription.status = SubscriptionStatus.CANCELLED;
        subscription.cancelledAt = new Date();
        subscription.autoRenew = false;
        break;
      case 'expired':
        subscription.status = SubscriptionStatus.EXPIRED;
        break;
      case 'payment_failed':
        // Payment failed: penalize immediately — revoke access now.
        subscription.status = SubscriptionStatus.SUSPENDED;
        subscription.lastPaymentStatus = 'failed';
        break;
    }

    await this.subscriptionRepo.save(subscription);

    // Only revoke isPaid for payment_failed (immediate) and expired (if no other active sub).
    // Cancelled: student keeps access until endDate — reconcile handles the rest.
    if (reason === 'payment_failed') {
      await this.studentsService.revokeExamAccessBySubscription(
        subscription.id,
      );
    } else if (reason === 'expired') {
      const otherActiveSub = await this.subscriptionRepo.findOne({
        where: {
          studentId: subscription.studentId,
          examTypeId: subscription.examTypeId,
          status: SubscriptionStatus.ACTIVE,
          id: Not(subscription.id),
        },
      });
      if (!otherActiveSub) {
        await this.studentsService.revokeExamAccessBySubscription(
          subscription.id,
        );
      }
    }

    // Log deactivation
    await this.loggerService.log({
      action: LogActionTypes.UPDATE,
      description: `Subscription ${reason}`,
      metadata: {
        subscriptionId: subscription.id,
        studentId: subscription.studentId,
        reason,
      },
    });

    // Track platform analytics for subscription churn (queued — side effect)
    if (reason === 'cancelled') {
      await this.analyticsQueue.add(AnalyticsJobs.TRACK_PLATFORM, {
        data: { cancelledSubscriptions: 1 },
      });
    }

    if (reason !== 'cancelled') {
      await this.analyticsQueue.add(AnalyticsJobs.TRACK_PLATFORM, {
        data: { premiumUsers: -1 },
      });
    }
  }

  /**
   * Find subscription by ID (any status)
   */
  async findSubscriptionById(
    subscriptionId: string,
  ): Promise<Subscription | null> {
    return this.subscriptionRepo.findOne({
      where: { id: subscriptionId },
      relations: ['plan'],
    });
  }

  /**
   * Find active subscription for student + exam type.
   * Auto-expires subscriptions whose endDate has passed (lazy expiration).
   */
  /** Batch: returns all ACTIVE subscriptions for the given students + examType. */
  async findActiveSubscriptionsForStudents(
    studentIds: string[],
    examTypeId: string,
  ): Promise<Subscription[]> {
    if (!studentIds.length) return [];
    return this.subscriptionRepo.find({
      where: {
        studentId: In(studentIds),
        examTypeId,
        status: SubscriptionStatus.ACTIVE,
      },
      select: ['studentId'],
    });
  }

  /**
   * Find a currently-live subscription: ACTIVE or CANCELLED with endDate still in the future.
   * No lazy side-effects — use reconcileStudentSub() to expire/promote.
   */
  async findCurrentSubscription(
    studentId: string,
    examTypeId: string,
  ): Promise<Subscription | null> {
    return this.subscriptionRepo.findOne({
      where: [
        {
          studentId,
          examTypeId,
          status: SubscriptionStatus.ACTIVE,
          endDate: MoreThan(new Date()),
        },
        {
          studentId,
          examTypeId,
          status: SubscriptionStatus.CANCELLED,
          endDate: MoreThan(new Date()),
        },
      ],
      relations: ['plan', 'planPrice'],
      order: { endDate: 'DESC' },
    });
  }

  /**
   * Find a SCHEDULED subscription for this student + examType.
   * A SCHEDULED sub has confirmed payment but a future start date (stacked resub).
   */
  async findScheduledSubscription(
    studentId: string,
    examTypeId: string,
  ): Promise<Subscription | null> {
    return this.subscriptionRepo.findOne({
      where: {
        studentId,
        examTypeId,
        status: SubscriptionStatus.SCHEDULED,
      },
      relations: ['plan'],
      order: { startDate: 'ASC' },
    });
  }

  /**
   * @deprecated Use findCurrentSubscription() instead.
   * Kept for callers that need a simple ACTIVE-only check (e.g. sponsor batch queries).
   */
  async findActiveSubscription(
    studentId: string,
    examTypeId: string,
  ): Promise<Subscription | null> {
    return this.subscriptionRepo.findOne({
      where: {
        studentId,
        examTypeId,
        status: SubscriptionStatus.ACTIVE,
      },
      relations: ['plan', 'planPrice'],
    });
  }

  /**
   * Reconcile a student's subscription state for one exam type.
   * - Expires any ACTIVE or CANCELLED sub whose endDate has passed → EXPIRED + isPaid=false
   * - Promotes a SCHEDULED sub whose scheduledStartDate has arrived → ACTIVE + isPaid=true
   *
   * Called at the start of getDashboard so the student always sees fresh state.
   * Scoped to one examType = O(1), no full-table scans.
   */
  async reconcileStudentSub(
    studentId: string,
    examTypeId: string,
  ): Promise<void> {
    const now = new Date();

    // 1. Find ACTIVE/CANCELLED subs past their endDate and expire them
    const outdatedSubs = await this.subscriptionRepo.find({
      where: [
        {
          studentId,
          examTypeId,
          status: SubscriptionStatus.ACTIVE,
          endDate: LessThan(now),
        },
        {
          studentId,
          examTypeId,
          status: SubscriptionStatus.CANCELLED,
          endDate: LessThan(now),
        },
      ],
    });

    for (const sub of outdatedSubs) {
      sub.status = SubscriptionStatus.EXPIRED;
      await this.subscriptionRepo.save(sub);
    }

    // 2. Check if a live sub still exists (ACTIVE or CANCELLED in range) after expiry
    const liveSubInRange =
      outdatedSubs.length > 0
        ? await this.subscriptionRepo.findOne({
            where: [
              {
                studentId,
                examTypeId,
                status: SubscriptionStatus.ACTIVE,
                endDate: MoreThan(now),
              },
              {
                studentId,
                examTypeId,
                status: SubscriptionStatus.CANCELLED,
                endDate: MoreThan(now),
              },
            ],
          })
        : null;

    // 3. Find SCHEDULED sub (ordered by startDate — earliest first)
    const scheduled = await this.subscriptionRepo.findOne({
      where: { studentId, examTypeId, status: SubscriptionStatus.SCHEDULED },
      relations: ['plan'],
      order: { startDate: 'ASC' },
    });

    const scheduledReady = !!(
      scheduled?.startDate && scheduled.startDate <= now
    );

    // 4. If we expired something and no live sub or ready scheduled sub remains → revoke access
    if (outdatedSubs.length > 0 && !liveSubInRange && !scheduledReady) {
      await this.studentsService.revokeExamAccess(studentId, examTypeId);
    }

    // 5. Promote SCHEDULED sub if its startDate has arrived
    if (scheduledReady && scheduled) {
      const studentExamType =
        await this.studentsService.findOrCreateStudentExamType(
          studentId,
          examTypeId,
        );

      scheduled.status = SubscriptionStatus.ACTIVE;
      scheduled.studentExamTypeId = studentExamType.id;
      await this.subscriptionRepo.save(scheduled);

      await this.studentsService.grantExamAccess(
        studentExamType.id,
        scheduled.id,
      );
    }
  }

  /**
   * Find a PENDING subscription for this student + examType.
   * PENDING = payment not yet confirmed. Kept for webhook payment verification lookups.
   */
  async findPendingSubscription(
    studentId: string,
    examTypeId: string,
  ): Promise<Subscription | null> {
    return this.subscriptionRepo.findOne({
      where: {
        studentId,
        examTypeId,
        status: SubscriptionStatus.PENDING,
      },
      relations: ['plan'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get student's subscription history
   */
  async getStudentSubscriptions(studentId: string): Promise<Subscription[]> {
    return this.subscriptionRepo.find({
      where: { studentId },
      relations: ['plan', 'examType'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get subscriptions gifted by a sponsor
   */
  async getSponsorGiftedSubscriptions(
    sponsorId: string,
  ): Promise<Subscription[]> {
    return this.subscriptionRepo.find({
      where: { sponsorId },
      relations: ['plan', 'examType', 'student'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Cancel subscription (user initiated)
   */
  async cancelSubscription(
    subscriptionId: string,
    _userId: string,
  ): Promise<void> {
    const subscription = await this.subscriptionRepo.findOne({
      where: { id: subscriptionId },
      relations: ['student'],
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    // Verify ownership (student or sponsor)
    // TODO: Add proper authorization check

    await this.deactivateSubscription(subscriptionId, 'cancelled');
  }

  /**
   * Check and expire overdue subscriptions (called by cron job)
   */
  // ─── Sponsor-specific queries ─────────────────────────────────────────────

  /** Paginated list of sponsor-funded subscriptions with plan & examType. */
  async getSponsoredSubscriptions(
    sponsorId: string,
    page: number,
    limit: number,
  ): Promise<{ subscriptions: Subscription[]; total: number }> {
    const [subscriptions, total] = await this.subscriptionRepo.findAndCount({
      where: { sponsorId },
      relations: ['plan', 'examType', 'student', 'student.user'],
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });
    return { subscriptions, total };
  }

  /** Stats for the Giveback History page cards. */
  async getGivebackPageStats(sponsorId: string): Promise<{
    totalSpent: number;
    totalGivebacks: number;
    thisMonthGivebacks: number;
    studentsSponsored: number;
    expiringSoon: number;
  }> {
    const givebackRepo = this.subscriptionRepo.manager.getRepository(Giveback);
    const now = new Date();
    const thisStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const in10Days = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);

    const allGivebacks = await givebackRepo.find({ where: { sponsorId } });

    const totalGivebacks = allGivebacks.length;

    const thisMonthGivebacks = allGivebacks.filter(
      (g) => new Date(g.createdAt) >= thisStart,
    ).length;

    const givebackIds = allGivebacks.map((g) => g.id);

    if (!givebackIds.length) {
      return {
        totalSpent: 0,
        totalGivebacks,
        thisMonthGivebacks,
        studentsSponsored: 0,
        expiringSoon: 0,
      };
    }

    // Only count givebacks where payment was verified (at least one ACTIVE subscription)
    const paidGivebackIds = await this.subscriptionRepo
      .createQueryBuilder('s')
      .select('DISTINCT s."givebackId"', 'givebackId')
      .where('s."givebackId" IN (:...givebackIds)', { givebackIds })
      .andWhere('s.status = :status', { status: SubscriptionStatus.ACTIVE })
      .getRawMany<{ givebackId: string }>()
      .then((rows) => new Set(rows.map((r) => r.givebackId)))
      .catch(() => new Set<string>());

    const totalSpent = allGivebacks
      .filter((g) => paidGivebackIds.has(g.id))
      .reduce((sum, g) => sum + (g.amount ?? 0), 0);

    // Count distinct students ever sponsored (deduplicated across multiple givebacks)
    const studentsSponsored = await this.subscriptionRepo
      .createQueryBuilder('s')
      .select('COUNT(DISTINCT s."studentId")', 'count')
      .where('s."givebackId" IN (:...givebackIds)', { givebackIds })
      .getRawOne<{ count: string }>()
      .then((r) => parseInt(r?.count ?? '0', 10))
      .catch(() => 0);

    // Count givebacks expiring within 10 days that haven't been resubbed yet
    // Uses giveback.status + endDate directly — set when payment is verified (no join needed)
    const expiringSoon = await givebackRepo
      .createQueryBuilder('g')
      .where('g.id IN (:...givebackIds)', { givebackIds })
      .andWhere('g.status = :gStatus', { gStatus: GivebackStatus.ACTIVE })
      .andWhere('g."endDate" BETWEEN :now AND :in10Days', { now, in10Days })
      .andWhere('g."hasResubbed" = false')
      .getCount()
      .catch(() => 0);

    return {
      totalSpent,
      totalGivebacks,
      thisMonthGivebacks,
      studentsSponsored,
      expiringSoon,
    };
  }

  /** Paginated giveback history for sponsor, each row enriched with first linked subscription summary. */
  async getSponsoredGivebacks(
    sponsorId: string,
    page: number,
    limit: number,
    status?: GivebackStatus,
  ): Promise<{ givebacks: any[]; total: number }> {
    const givebackRepo = this.subscriptionRepo.manager.getRepository(Giveback);

    // Lazy expiration: mark any of this sponsor's ACTIVE givebacks whose endDate has passed.
    // Scoped to sponsorId — hits only an indexed subset, not the full table. Fast.
    await givebackRepo.update(
      {
        sponsorId,
        status: GivebackStatus.ACTIVE,
        endDate: LessThan(new Date()),
      },
      { status: GivebackStatus.EXPIRED },
    );

    const [givebacks, total] = await givebackRepo.findAndCount({
      where: { sponsorId, ...(status ? { status } : {}) },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Enrich each giveback with first linked subscription (for exam + plan labels)
    const enriched = await Promise.all(
      givebacks.map(async (gb) => {
        const firstSub = await this.subscriptionRepo.findOne({
          where: { givebackId: gb.id },
          relations: ['plan', 'examType'],
          order: { createdAt: 'ASC' },
        });
        return { ...gb, subscription: firstSub ?? null };
      }),
    );

    return { givebacks: enriched, total };
  }

  /** Get giveback by id with all linked subscriptions (for detail view). */
  async getGivebackDetail(
    sponsorId: string,
    givebackId: string,
  ): Promise<{ giveback: Giveback; subscriptions: Subscription[] } | null> {
    const givebackRepo = this.subscriptionRepo.manager.getRepository(Giveback);
    const giveback = await givebackRepo.findOne({
      where: { id: givebackId, sponsorId },
    });
    if (!giveback) return null;

    const subscriptions = await this.subscriptionRepo.find({
      where: { givebackId },
      relations: ['plan', 'examType', 'student', 'student.user'],
      order: { createdAt: 'ASC' },
    });

    return { giveback, subscriptions };
  }

  /** Find all subscriptions linked to a giveback. */
  async findSubscriptionsByGivebackId(
    givebackId: string,
  ): Promise<Subscription[]> {
    return this.subscriptionRepo.find({
      where: { givebackId },
      relations: ['plan', 'student', 'examType'],
    });
  }

  /** Find only ACTIVE subscriptions for a giveback (used during resub to get each student's endDate). */
  async findActiveSubsByGivebackId(
    givebackId: string,
  ): Promise<Subscription[]> {
    return this.subscriptionRepo.find({
      where: { givebackId, status: SubscriptionStatus.ACTIVE },
    });
  }

  /** Get one activated sub for a giveback — used to stamp giveback.endDate after verification. */
  async findFirstActivatedSubForGiveback(
    givebackId: string,
  ): Promise<Subscription | null> {
    return this.subscriptionRepo.findOne({
      where: { givebackId, status: SubscriptionStatus.ACTIVE },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Givebacks with at least one ACTIVE sub expiring within 10 days and hasResubbed = false.
   * Used to populate the "expiring soon" section on the sponsor giveback page.
   */
  async getExpiringSoonGivebacks(sponsorId: string): Promise<any[]> {
    const givebackRepo = this.subscriptionRepo.manager.getRepository(Giveback);
    const now = new Date();
    const in10Days = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);

    // Direct query on giveback.status + endDate — no join, no derivation
    const expiringGivebacks = await givebackRepo.find({
      where: {
        sponsorId,
        status: GivebackStatus.ACTIVE,
        hasResubbed: false,
        endDate: Between(now, in10Days),
      },
      order: { endDate: 'ASC' },
    });

    if (!expiringGivebacks.length) return [];

    return Promise.all(
      expiringGivebacks.map(async (gb) => {
        const subs = await this.subscriptionRepo.find({
          where: { givebackId: gb.id, status: SubscriptionStatus.ACTIVE },
          relations: ['plan', 'examType', 'student', 'student.user'],
          order: { endDate: 'ASC' },
        });
        return { ...gb, subscriptions: subs, earliestExpiry: gb.endDate };
      }),
    );
  }

  /** Delete all PENDING subscriptions linked to a giveback (cleanup on Paystack init failure). */
  async cancelPendingGivebackSubscriptions(givebackId: string): Promise<void> {
    await this.subscriptionRepo.delete({
      givebackId,
      status: SubscriptionStatus.PENDING,
    });
  }

  async expireOverdueSubscriptions(): Promise<number> {
    const now = new Date();

    const overdueSubscriptions = await this.subscriptionRepo.find({
      where: {
        status: SubscriptionStatus.ACTIVE,
        endDate: LessThan(now),
      },
    });

    for (const subscription of overdueSubscriptions) {
      await this.deactivateSubscription(subscription.id, 'expired');
    }

    return overdueSubscriptions.length;
  }

  /**
   * Find subscription by provider subscription ID
   */
  async findByProviderSubscriptionId(
    providerSubscriptionId: string,
  ): Promise<Subscription | null> {
    return this.subscriptionRepo.findOne({
      where: { providerSubscriptionId },
      relations: ['plan', 'student'],
    });
  }

  /**
   * Update subscription's last payment status
   */
  async updatePaymentStatus(
    subscriptionId: string,
    status: string,
  ): Promise<void> {
    await this.subscriptionRepo.update(subscriptionId, {
      lastPaymentStatus: status,
    });
  }

  /**
   * Update provider-specific IDs on a subscription
   * Used by webhooks to store subscription_code, customer_code, etc.
   */
  async updateProviderInfo(
    subscriptionId: string,
    data: {
      providerSubscriptionId?: string;
      providerCustomerId?: string;
    },
  ): Promise<void> {
    await this.subscriptionRepo.update(subscriptionId, data);
  }

  /**
   * Find a recent subscription by provider customer ID and plan code.
   * Used by subscription.create webhook to match Paystack subscription_code
   * to our internal subscription after the initial charge.success has fired.
   */
  async findRecentByProviderCustomer(
    provider: PaymentProvider,
    providerCustomerId: string,
    planCode: string,
  ): Promise<Subscription | null> {
    // Find plan prices that match this Paystack plan code
    const matchingPrices = await this.planPriceRepo.find({
      where: { paystackPlanCode: planCode, isActive: true },
    });

    if (matchingPrices.length === 0) return null;

    const planIds = [...new Set(matchingPrices.map((p) => p.planId))];

    // Search ACTIVE first, then PENDING (charge.success may not have activated yet)
    const statusPriority = [
      SubscriptionStatus.ACTIVE,
      SubscriptionStatus.PENDING,
    ];

    for (const status of statusPriority) {
      for (const planId of planIds) {
        const subscription = await this.subscriptionRepo.findOne({
          where: {
            planId,
            providerCustomerId: providerCustomerId,
            paymentProvider: provider,
            status,
          },
          order: { createdAt: 'DESC' },
          relations: ['plan'],
        });

        if (subscription) return subscription;
      }
    }

    return null;
  }

  /**
   * Find a subscription by the student's email and Paystack plan code.
   * Uses QueryBuilder to join through StudentProfile → User.
   *
   * This is the most reliable matching strategy for subscription.create
   * webhooks because email is always present and doesn't depend on
   * charge.success having fired first.
   */
  async findSubscriptionByStudentEmail(
    provider: PaymentProvider,
    email: string,
    planCode: string,
  ): Promise<Subscription | null> {
    // Resolve planCode (PLN_xxx) → planIds
    const matchingPrices = await this.planPriceRepo.find({
      where: { paystackPlanCode: planCode, isActive: true },
    });
    if (matchingPrices.length === 0) return null;
    const planIds = [...new Set(matchingPrices.map((p) => p.planId))];

    // Join through StudentProfile → User, filter by email + plan + provider
    return this.subscriptionRepo
      .createQueryBuilder('sub')
      .leftJoin('sub.student', 'student')
      .leftJoin('student.user', 'user')
      .leftJoinAndSelect('sub.plan', 'plan')
      .where('user.email = :email', { email })
      .andWhere('sub.planId IN (:...planIds)', { planIds })
      .andWhere('sub.paymentProvider = :provider', { provider })
      .andWhere('sub.status IN (:...statuses)', {
        statuses: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PENDING],
      })
      .orderBy('sub.createdAt', 'DESC')
      .getOne();
  }

  /**
   * Renew an existing subscription.
   * - ACTIVE: extend endDate from current end (normal recurring renewal)
   * - EXPIRED/SUSPENDED: revive from now (late card retry or payment recovery)
   *   Re-links StudentExamType and restores isPaid=true.
   */
  async renewSubscription(
    subscriptionId: string,
    amount: number,
  ): Promise<void> {
    const subscription = await this.subscriptionRepo.findOne({
      where: { id: subscriptionId },
      relations: ['plan'],
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    const wasActive = subscription.status === SubscriptionStatus.ACTIVE;

    if (wasActive && subscription.endDate) {
      // Normal renewal: extend from where the last period ended
      const newEndDate = new Date(subscription.endDate);
      newEndDate.setDate(newEndDate.getDate() + subscription.plan.durationDays);
      subscription.endDate = newEndDate;
    } else {
      // Revival (EXPIRED/SUSPENDED): payment came through late — restart from now
      const now = new Date();
      const newEndDate = new Date(now);
      newEndDate.setDate(newEndDate.getDate() + subscription.plan.durationDays);
      subscription.startDate = now;
      subscription.endDate = newEndDate;
    }

    subscription.status = SubscriptionStatus.ACTIVE;
    subscription.lastPaymentStatus = 'succeeded';
    await this.subscriptionRepo.save(subscription);

    // If revived from EXPIRED/SUSPENDED: restore isPaid on StudentExamType
    if (!wasActive) {
      const studentExamType =
        await this.studentsService.findOrCreateStudentExamType(
          subscription.studentId,
          subscription.examTypeId,
        );

      subscription.studentExamTypeId = studentExamType.id;
      await this.subscriptionRepo.save(subscription);

      await this.studentsService.grantExamAccess(
        studentExamType.id,
        subscription.id,
      );
    }

    // Log renewal
    await this.loggerService.log({
      action: LogActionTypes.PAYMENT,
      description: 'Subscription renewed',
      metadata: {
        subscriptionId,
        studentId: subscription.studentId,
        examTypeId: subscription.examTypeId,
        newEndDate: subscription.endDate?.toISOString(),
      },
    });

    // Track renewal revenue (queued — side effect)
    await this.analyticsQueue.add(AnalyticsJobs.TRACK_PLATFORM, {
      data: { totalRevenue: amount },
    });

    // Affiliate commission on renewal
    if (amount > 0) {
      try {
        const subWithStudent = await this.subscriptionRepo.findOne({
          where: { id: subscriptionId },
          relations: ['plan', 'student', 'student.user'],
        });

        if (subWithStudent?.student?.userId) {
          const referral = await this.affiliatesService.findReferralByUserId(
            subWithStudent.student.userId,
          );
          if (referral) {
            const affiliateProfile = await this.affiliatesService.findById(
              referral.affiliateId,
            );
            if (affiliateProfile) {
              const affiliateUser = await this.subscriptionRepo.manager
                .getRepository(User)
                .findOne({ where: { id: affiliateProfile.userId } });

              if (affiliateUser && affiliateUser.role !== UserType.SPONSOR) {
                // If affiliate is a student, they must have subscribed before to earn commissions
                let canEarn = true;
                if (affiliateUser.role === UserType.STUDENT) {
                  canEarn = await this.studentsService.hasStudentEverSubscribed(
                    affiliateProfile.userId,
                  );
                }

                if (canEarn) {
                  // Renewal commission (non-blocking — errors caught by outer try/catch)
                  void this.affiliatesService
                    .createCommission({
                      affiliateId: referral.affiliateId,
                      referralId: referral.id,
                      subscriptionId: subWithStudent.id,
                      subscriptionAmount: amount,
                      currency: subWithStudent.currency,
                      planName: subWithStudent.plan?.name,
                    })
                    .catch(() => {
                      // Don't fail renewal if commission creation fails
                    });
                }
              }
            }
          }
        }
      } catch {
        // Don't fail renewal if commission creation fails
      }
    }
  }

  /**
   * Get checkout info for a region (currency, provider, prices)
   */
  async getCheckoutInfo(
    examTypeId: string,
    regionCode: string,
  ): Promise<{
    currency: Currency;
    provider: PaymentProvider;
    plans: Array<{
      id: string;
      name: string;
      description: string;
      durationDays: number;
      price: number;
      stripePriceId?: string;
      paystackPlanCode?: string;
    }>;
  }> {
    // Get region currency mapping
    let regionCurrency = await this.regionCurrencyRepo.findOne({
      where: { regionCode, isActive: true },
    });

    // Default to USD/Stripe if region not found
    if (!regionCurrency) {
      regionCurrency = {
        currency: Currency.USD,
        paymentProvider: PaymentProvider.STRIPE,
      } as RegionCurrency;
    }

    // Get active plans for this exam type
    const plans = await this.planRepo.find({
      where: { examTypeId, isActive: true },
      relations: ['prices'],
      order: { sortOrder: 'ASC' },
    });

    // Map plans with prices in the detected currency
    const plansWithPrices = plans.map((plan) => {
      const priceRecord = plan.prices?.find(
        (p) => p.currency === regionCurrency.currency && p.isActive,
      );

      return {
        id: plan.id,
        name: plan.name,
        description: plan.description || '',
        durationDays: plan.durationDays,
        price: priceRecord?.amount || 0,
        planPriceId: priceRecord?.id,
        stripePriceId: priceRecord?.stripePriceId,
        paystackPlanCode: priceRecord?.paystackPlanCode,
      };
    });

    return {
      currency: regionCurrency.currency,
      provider: regionCurrency.paymentProvider,
      plans: plansWithPrices,
    };
  }

  /**
   * Get all available currencies + detect default from IP
   */
  async getAvailableCurrencies(ipAddress: string) {
    // Get distinct active currencies
    const results = await this.regionCurrencyRepo
      .createQueryBuilder('rc')
      .select('DISTINCT rc.currency', 'currency')
      .where('rc.isActive = :isActive', { isActive: true })
      .getRawMany<{ currency: Currency }>();

    const currencies = results.map((r) => r.currency);

    // Detect default currency from IP
    const regionCode = await this.getRegionFromIp(ipAddress);
    const regionCurrency = await this.regionCurrencyRepo.findOne({
      where: { regionCode, isActive: true },
    });

    const defaultCurrency = regionCurrency?.currency || Currency.USD;

    return { currencies, defaultCurrency };
  }

  /**
   * Detect region from IP address using ip-api.com
   * For local/private IPs, fetches the server's public IP first
   */
  async getRegionFromIp(ipAddress: string): Promise<string> {
    try {
      let ip = ipAddress;

      // Normalize IPv6-mapped IPv4 (e.g., "::ffff:192.168.1.1" → "192.168.1.1")
      if (ip.startsWith('::ffff:')) {
        ip = ip.substring(7);
      }

      // Check for local/private IPs
      const isLocalIp =
        !ip ||
        ip === '127.0.0.1' ||
        ip === '::1' ||
        ip.startsWith('127.') ||
        ip.startsWith('192.168.') ||
        ip.startsWith('10.') ||
        ip.startsWith('172.16.') ||
        ip.startsWith('172.17.') ||
        ip.startsWith('172.18.') ||
        ip.startsWith('172.19.') ||
        ip.startsWith('172.2') ||
        ip.startsWith('172.30.') ||
        ip.startsWith('172.31.');

      if (isLocalIp) {
        this.logger.debug(`Local IP detected (${ip}), fetching public IP...`);

        const publicIpResponse = await fetch(
          'https://api64.ipify.org?format=json',
        );
        if (!publicIpResponse.ok) {
          this.logger.warn('Failed to fetch public IP, returning DEFAULT');
          return 'DEFAULT';
        }

        const publicIpData = (await publicIpResponse.json()) as { ip?: string };
        ip = publicIpData.ip || '';

        if (!ip) {
          this.logger.warn('No public IP returned, returning DEFAULT');
          return 'DEFAULT';
        }

        this.logger.debug(`Using public IP: ${ip}`);
      }

      const response = await fetch(
        `http://ip-api.com/json/${ip}?fields=countryCode,status,message`,
      );

      if (!response.ok) {
        this.logger.warn(`IP-API request failed for IP: ${ip}`);
        return 'DEFAULT';
      }

      const data = (await response.json()) as {
        countryCode?: string;
        status?: string;
        message?: string;
      };

      if (data.status === 'fail') {
        this.logger.warn(`IP-API returned failure for ${ip}: ${data.message}`);
        return 'DEFAULT';
      }

      return data.countryCode || 'DEFAULT';
    } catch (error) {
      this.logger.error(`Error detecting region for IP ${ipAddress}: ${error}`);
      return 'DEFAULT';
    }
  }

  /**
   * Get checkout info with IP-based region detection
   */
  async getCheckoutInfoFromIp(
    examTypeId: string,
    ipAddress: string,
  ): Promise<{
    region: string;
    currency: Currency;
    provider: PaymentProvider;
    plans: Array<{
      id: string;
      name: string;
      description: string;
      durationDays: number;
      price: number;
      stripePriceId?: string;
      paystackPlanCode?: string;
    }>;
  }> {
    const region = await this.getRegionFromIp(ipAddress);
    const checkoutInfo = await this.getCheckoutInfo(examTypeId, region);

    return {
      region,
      ...checkoutInfo,
    };
  }

  /**
   * Fetch subscription details from Paystack API
   */
  async fetchPaystackSubscription(subscriptionCode: string): Promise<{
    brand: string;
    last4: string;
    expMonth: string;
    expYear: string;
    bank: string | null;
    channel: string | null;
    next_payment_date: string | null;
  } | null> {
    const paystackSecretKey = this.configService.get<string>(
      'PAYSTACK_SECRET_KEY',
    );
    if (!paystackSecretKey || !subscriptionCode) return null;

    try {
      const response = await fetch(
        `https://api.paystack.co/subscription/${subscriptionCode}`,
        {
          headers: {
            Authorization: `Bearer ${paystackSecretKey}`,
          },
        },
      );

      if (!response.ok) return null;

      const result = (await response.json()) as {
        status: boolean;
        data?: {
          next_payment_date?: string;
          authorization?: {
            brand: string;
            last4: string;
            exp_month: string;
            exp_year: string;
            bank: string;
            channel: string;
          };
        };
      };

      if (!result.status || !result.data?.authorization) return null;

      const auth = result.data.authorization;
      return {
        brand: auth.brand,
        last4: auth.last4,
        expMonth: auth.exp_month,
        expYear: auth.exp_year,
        bank: auth.bank || null,
        channel: auth.channel || null,
        next_payment_date: result.data.next_payment_date ?? null,
      };
    } catch {
      return null;
    }
  }

  /**
   * Get Paystack subscription manage link (for card updates)
   */
  async getPaystackManageLink(
    subscriptionCode: string,
  ): Promise<string | null> {
    const paystackSecretKey = this.configService.get<string>(
      'PAYSTACK_SECRET_KEY',
    );
    if (!paystackSecretKey || !subscriptionCode) return null;

    try {
      const response = await fetch(
        `https://api.paystack.co/subscription/${subscriptionCode}/manage/link`,
        {
          headers: {
            Authorization: `Bearer ${paystackSecretKey}`,
          },
        },
      );

      if (!response.ok) return null;

      const result = (await response.json()) as {
        status: boolean;
        data?: { link: string };
      };

      if (!result.status || !result.data?.link) return null;

      return result.data.link;
    } catch {
      return null;
    }
  }

  /**
   * Find a PlanPrice by planId and currency code.
   */
  async findPlanPrice(
    planId: string,
    currency: string,
  ): Promise<PlanPrice | null> {
    return this.planPriceRepo.findOne({
      where: { planId, currency: currency as Currency, isActive: true },
    });
  }

  /** Find a PlanPrice by its own ID. */
  async findPlanPriceById(planPriceId: string): Promise<PlanPrice | null> {
    return this.planPriceRepo.findOne({
      where: { id: planPriceId, isActive: true },
    });
  }

  /** Find a SubscriptionPlan by its own ID. */
  async findPlanById(planId: string): Promise<SubscriptionPlan | null> {
    return this.planRepo.findOne({ where: { id: planId, isActive: true } });
  }

  /**
   * Cancel a Paystack subscription (disable recurring charges).
   * Fetches the email_token first, then calls POST /subscription/disable.
   */
  async cancelPaystackSubscription(subscriptionCode: string): Promise<boolean> {
    const paystackSecretKey = this.configService.get<string>(
      'PAYSTACK_SECRET_KEY',
    );
    if (!paystackSecretKey || !subscriptionCode) return false;

    try {
      // Fetch subscription to get email_token
      const subResponse = await fetch(
        `https://api.paystack.co/subscription/${subscriptionCode}`,
        {
          headers: { Authorization: `Bearer ${paystackSecretKey}` },
        },
      );

      if (!subResponse.ok) return false;

      const subResult = (await subResponse.json()) as {
        status: boolean;
        data?: { email_token: string };
      };

      const emailToken = subResult.data?.email_token;
      if (!emailToken) return false;

      // Disable subscription (stops future renewals)
      const response = await fetch(
        'https://api.paystack.co/subscription/disable',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${paystackSecretKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            code: subscriptionCode,
            token: emailToken,
          }),
        },
      );

      const result = (await response.json()) as { status: boolean };
      return result.status === true;
    } catch {
      return false;
    }
  }

  /**
   * Re-enable a Paystack subscription that was previously disabled.
   */
  async reactivatePaystackSubscription(
    subscriptionCode: string,
  ): Promise<boolean> {
    const paystackSecretKey = this.configService.get<string>(
      'PAYSTACK_SECRET_KEY',
    );
    if (!paystackSecretKey || !subscriptionCode) return false;

    try {
      // Fetch subscription to get email_token
      const subResponse = await fetch(
        `https://api.paystack.co/subscription/${subscriptionCode}`,
        {
          headers: { Authorization: `Bearer ${paystackSecretKey}` },
        },
      );

      if (!subResponse.ok) {
        this.logger.error(
          `Paystack reactivate: failed to fetch subscription ${subscriptionCode} (status ${subResponse.status})`,
        );
        return false;
      }

      const subResult = (await subResponse.json()) as {
        status: boolean;
        data?: { email_token: string; status: string };
      };

      this.logger.debug(
        `Paystack reactivate: subscription ${subscriptionCode} status ${subResult.data?.status}`,
      );

      const emailToken = subResult.data?.email_token;
      if (!emailToken) {
        this.logger.error(
          `Paystack reactivate: no email_token for ${subscriptionCode}`,
        );
        return false;
      }

      // Enable subscription (resumes renewals)
      const response = await fetch(
        'https://api.paystack.co/subscription/enable',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${paystackSecretKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            code: subscriptionCode,
            token: emailToken,
          }),
        },
      );

      const result = (await response.json()) as {
        status: boolean;
        message?: string;
      };

      this.logger.debug(
        `Paystack reactivate response for ${subscriptionCode}: ${JSON.stringify(result)}`,
      );

      return result.status === true;
    } catch (error) {
      this.logger.error(`Paystack reactivate error: ${error}`);
      return false;
    }
  }

  /**
   * Get the authorization code from a Paystack subscription.
   * Needed for creating a new subscription on the same card.
   */
  async getPaystackAuthorizationCode(
    subscriptionCode: string,
  ): Promise<string | null> {
    const paystackSecretKey = this.configService.get<string>(
      'PAYSTACK_SECRET_KEY',
    );
    if (!paystackSecretKey || !subscriptionCode) return null;

    try {
      const response = await fetch(
        `https://api.paystack.co/subscription/${subscriptionCode}`,
        {
          headers: { Authorization: `Bearer ${paystackSecretKey}` },
        },
      );

      if (!response.ok) return null;

      const result = (await response.json()) as {
        status: boolean;
        data?: { authorization?: { authorization_code: string } };
      };

      const authCode = result.data?.authorization?.authorization_code || null;
      this.logger.debug(
        `Paystack auth code for ${subscriptionCode}: ${authCode ? 'found' : 'NOT FOUND'}`,
      );
      return authCode;
    } catch (error) {
      this.logger.error(`Paystack get auth code error: ${error}`);
      return null;
    }
  }

  /**
   * Create a new Paystack subscription (for upgrades/downgrades).
   * Uses existing customer + authorization to subscribe to a different plan.
   */
  async createPaystackSubscription(data: {
    customerCode: string;
    planCode: string;
    authorizationCode: string;
    startDate?: string;
  }): Promise<{ subscriptionCode: string } | null> {
    const paystackSecretKey = this.configService.get<string>(
      'PAYSTACK_SECRET_KEY',
    );
    if (!paystackSecretKey) return null;

    try {
      const body: Record<string, string> = {
        customer: data.customerCode,
        plan: data.planCode,
        authorization: data.authorizationCode,
      };
      if (data.startDate) body.start_date = data.startDate;

      const response = await fetch('https://api.paystack.co/subscription', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${paystackSecretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const result = (await response.json()) as {
        status: boolean;
        message?: string;
        data?: { subscription_code: string };
      };

      if (!result.status || !result.data?.subscription_code) {
        this.logger.error(
          `Paystack create subscription failed: ${result.message}`,
        );
        return null;
      }

      this.logger.log(
        `Paystack subscription created: ${result.data.subscription_code}`,
      );
      return { subscriptionCode: result.data.subscription_code };
    } catch (error) {
      this.logger.error(`Paystack create subscription error: ${error}`);
      return null;
    }
  }
}
