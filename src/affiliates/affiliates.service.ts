import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { AffiliateProfile } from './entities/affiliate-profile.entity';
import { AffiliateReferral } from './entities/affiliate-referral.entity';
import { Commission } from './entities/commission.entity';
import { AffiliatePayout } from '../analytics/entities/affiliate-payout.entity';
import { LoggerService } from '../logger/logger.service';
import { AnalyticsService } from '../analytics/analytics.service';
import {
  LogActionTypes,
  ReferredUserType,
  Currency,
  PayoutStatus,
  CommissionStatus,
} from '../../types';

const COMMISSION_RATE = 0.15; // 15%

/**
 * Get the calendar date parts (year, month-0indexed, day, day-of-week)
 * for `now` expressed in the given IANA timezone.
 * Uses Intl.DateTimeFormat — no external dependencies.
 */
function getLocalDateParts(
  now: Date,
  timezone: string,
): { year: number; month: number; day: number; dow: number } {
  let fmt: Intl.DateTimeFormat;
  try {
    fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    // Fall back to UTC for unknown/invalid timezone strings
    fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }
  const parts = Object.fromEntries(
    fmt.formatToParts(now).map((p) => [p.type, p.value]),
  );
  const year = parseInt(parts.year, 10);
  const month = parseInt(parts.month, 10) - 1; // 0-indexed
  const day = parseInt(parts.day, 10);
  // Day-of-week: create a "fake UTC" date from the local calendar values
  const dow = new Date(Date.UTC(year, month, day)).getUTCDay(); // 0=Sun … 6=Sat
  return { year, month, day, dow };
}

@Injectable()
export class AffiliatesService {
  constructor(
    @InjectRepository(AffiliateProfile)
    private affiliateProfileRepo: Repository<AffiliateProfile>,
    @InjectRepository(AffiliateReferral)
    private affiliateReferralRepo: Repository<AffiliateReferral>,
    @InjectRepository(Commission)
    private commissionRepo: Repository<Commission>,
    @InjectRepository(AffiliatePayout)
    private affiliatePayoutRepo: Repository<AffiliatePayout>,
    private loggerService: LoggerService,
    private analyticsService: AnalyticsService,
  ) {}

  /**
   * Create affiliate profile during signup/onboarding
   * Default affiliate code = profile UUID (can be customized later)
   */
  async createAffiliateProfile(data: {
    userId: string;
    firstName: string;
    lastName: string;
    affiliateCode?: string;
    phoneNumber?: string;
    countryCode?: string;
  }): Promise<AffiliateProfile> {
    // Create profile with a temporary code (will be updated to UUID after save)
    const profile = this.affiliateProfileRepo.create({
      userId: data.userId,
      affiliateCode: `temp-${Date.now()}`,
    });

    const savedProfile = await this.affiliateProfileRepo.save(profile);

    // Set affiliate code: use provided custom code or default to profile UUID
    let affiliateCode = data.affiliateCode;
    if (affiliateCode) {
      const existing = await this.affiliateProfileRepo.findOne({
        where: { affiliateCode },
      });
      if (existing) {
        affiliateCode = savedProfile.id;
      }
    } else {
      affiliateCode = savedProfile.id;
    }

    savedProfile.affiliateCode = affiliateCode;
    await this.affiliateProfileRepo.save(savedProfile);

    await this.loggerService.log({
      userId: data.userId,
      action: LogActionTypes.CREATE,
      description: 'Affiliate profile created',
      metadata: {
        profileId: savedProfile.id,
        affiliateCode: savedProfile.affiliateCode,
      },
    });

    return savedProfile;
  }

  /**
   * Find affiliate profile by userId
   */
  async findByUserId(userId: string): Promise<AffiliateProfile | null> {
    return await this.affiliateProfileRepo.findOne({
      where: { userId },
    });
  }

  /**
   * Find affiliate by their affiliate code (e.g., AFF-xxx)
   * Used to resolve referral codes during signup
   */
  async findByAffiliateCode(
    affiliateCode: string,
  ): Promise<AffiliateProfile | null> {
    return await this.affiliateProfileRepo.findOne({
      where: { affiliateCode },
    });
  }

  /**
   * Create a referral record when a user signs up with a referral code
   */
  async createReferral(data: {
    affiliateId: string;
    referredUserId: string;
    userType: ReferredUserType;
  }): Promise<AffiliateReferral> {
    const referral = this.affiliateReferralRepo.create({
      affiliateId: data.affiliateId,
      referredUserId: data.referredUserId,
      userType: data.userType,
    });

    const savedReferral = await this.affiliateReferralRepo.save(referral);

    // Increment affiliate's totalReferrals
    await this.affiliateProfileRepo.increment(
      { id: data.affiliateId },
      'totalReferrals',
      1,
    );

    // TODO: Move to Kafka/message queue for async processing
    await this.analyticsService.trackAffiliateDailyAnalytics(data.affiliateId, {
      newReferrals: 1,
    });

    await this.loggerService.log({
      action: LogActionTypes.CREATE,
      description: 'Affiliate referral created',
      metadata: {
        affiliateId: data.affiliateId,
        referredUserId: data.referredUserId,
        userType: data.userType,
      },
    });

    return savedReferral;
  }

  /**
   * Check if a user was referred by an affiliate
   */
  async findReferralByUserId(
    userId: string,
  ): Promise<AffiliateReferral | null> {
    return await this.affiliateReferralRepo.findOne({
      where: { referredUserId: userId },
    });
  }

  /**
   * Find affiliate profile by ID
   */
  async findById(affiliateId: string): Promise<AffiliateProfile | null> {
    return await this.affiliateProfileRepo.findOne({
      where: { id: affiliateId },
    });
  }

  /**
   * Mark a referral as converted (first subscription)
   */
  async markReferralConverted(referralId: string): Promise<void> {
    await this.affiliateReferralRepo.update(referralId, {
      hasSubscribed: true,
      subscribedAt: new Date(),
    });
  }

  /**
   * Increment totalConversions counter on affiliate profile
   */
  async incrementConversions(affiliateId: string): Promise<void> {
    await this.affiliateProfileRepo.increment(
      { id: affiliateId },
      'totalConversions',
      1,
    );
  }

  /**
   * Create a commission when a referred user subscribes
   * Rate: 15% of subscription amount
   */
  async createCommission(data: {
    affiliateId: string;
    referralId: string;
    subscriptionId: string;
    subscriptionAmount: number;
    currency?: Currency;
    planName?: string;
  }): Promise<Commission> {
    const commissionAmount = data.subscriptionAmount * COMMISSION_RATE;

    const commission = this.commissionRepo.create({
      affiliateId: data.affiliateId,
      referralId: data.referralId,
      subscriptionId: data.subscriptionId,
      subscriptionAmount: data.subscriptionAmount,
      amount: commissionAmount,
      currency: data.currency,
      planName: data.planName,
    });

    const savedCommission = await this.commissionRepo.save(commission);

    // Track revenue on referral
    await this.affiliateReferralRepo.update(data.referralId, {
      totalRevenueGenerated: () =>
        `"totalRevenueGenerated" + ${data.subscriptionAmount}`,
    });

    // Update affiliate earnings
    await this.affiliateProfileRepo.increment(
      { id: data.affiliateId },
      'totalEarnings',
      commissionAmount,
    );
    await this.affiliateProfileRepo.increment(
      { id: data.affiliateId },
      'pendingBalance',
      commissionAmount,
    );

    await this.loggerService.log({
      action: LogActionTypes.PAYMENT,
      description: 'Commission created for affiliate',
      metadata: {
        affiliateId: data.affiliateId,
        referralId: data.referralId,
        subscriptionId: data.subscriptionId,
        subscriptionAmount: data.subscriptionAmount,
        commissionAmount,
        currency: data.currency,
        planName: data.planName,
      },
    });

    return savedCommission;
  }

  // ─── Dashboard Methods ─────────────────────────────────────────

  /**
   * Get dashboard summary for an affiliate
   * When currency is provided, totalEarnings and pendingBalance are computed
   * from commissions in that currency instead of the profile-level totals.
   */
  async getDashboard(userId: string, currency?: Currency) {
    const profile = await this.affiliateProfileRepo.findOne({
      where: { userId },
    });

    if (!profile) return null;

    let totalEarnings = profile.totalEarnings;
    let pendingBalance = profile.pendingBalance;
    let totalPaidOut = profile.totalPaidOut;

    if (currency) {
      // Compute earnings for this specific currency from commissions
      const earningsResult = await this.commissionRepo
        .createQueryBuilder('c')
        .select('COALESCE(SUM(c.amount), 0)', 'total')
        .where('c.affiliateId = :affiliateId', { affiliateId: profile.id })
        .andWhere('c.currency = :currency', { currency })
        .getRawOne<{ total: string }>();
      totalEarnings = parseFloat(earningsResult?.total || '0');

      const pendingResult = await this.commissionRepo
        .createQueryBuilder('c')
        .select('COALESCE(SUM(c.amount), 0)', 'total')
        .where('c.affiliateId = :affiliateId', { affiliateId: profile.id })
        .andWhere('c.currency = :currency', { currency })
        .andWhere('c.status = :status', { status: CommissionStatus.PENDING })
        .getRawOne<{ total: string }>();
      pendingBalance = parseFloat(pendingResult?.total || '0');

      // totalPaidOut for currency = totalEarnings - pendingBalance
      totalPaidOut = totalEarnings - pendingBalance;
    }

    // Get previous month stats for comparison
    const now = new Date();
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(
      now.getFullYear(),
      now.getMonth(),
      0,
      23,
      59,
      59,
    );

    // Count referrals from last month
    const lastMonthReferrals = await this.affiliateReferralRepo.count({
      where: {
        affiliateId: profile.id,
        createdAt: Between(lastMonthStart, lastMonthEnd),
      },
    });

    // Count conversions from last month
    const lastMonthConversions = await this.affiliateReferralRepo.count({
      where: {
        affiliateId: profile.id,
        hasSubscribed: true,
        subscribedAt: Between(lastMonthStart, lastMonthEnd),
      },
    });

    // Get last month earnings (filtered by currency if provided)
    const lastMonthEarningsQuery = this.commissionRepo
      .createQueryBuilder('c')
      .select('COALESCE(SUM(c.amount), 0)', 'total')
      .where('c.affiliateId = :affiliateId', { affiliateId: profile.id })
      .andWhere('c.createdAt BETWEEN :start AND :end', {
        start: lastMonthStart,
        end: lastMonthEnd,
      });

    if (currency) {
      lastMonthEarningsQuery.andWhere('c.currency = :currency', { currency });
    }

    const lastMonthEarningsResult = await lastMonthEarningsQuery.getRawOne<{
      total: string;
    }>();
    const lastMonthEarnings = parseFloat(lastMonthEarningsResult?.total || '0');

    return {
      affiliateCode: profile.affiliateCode,
      totalReferrals: profile.totalReferrals,
      totalConversions: profile.totalConversions,
      conversionRate:
        profile.totalReferrals > 0
          ? profile.totalConversions / profile.totalReferrals
          : 0,
      totalEarnings,
      pendingBalance,
      totalPaidOut,
      referredNotSubscribed: profile.totalReferrals - profile.totalConversions,
      previousMonth: {
        referrals: lastMonthReferrals,
        conversions: lastMonthConversions,
        earnings: lastMonthEarnings,
      },
    };
  }

  /**
   * Get paginated referrals for an affiliate
   */
  async getReferrals(
    affiliateId: string,
    page: number,
    limit: number,
    currency?: Currency,
  ) {
    const [data, total] = await this.affiliateReferralRepo.findAndCount({
      where: { affiliateId },
      relations: ['referredUser'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    // If currency is specified, calculate revenue and commission per currency
    if (currency) {
      const referralsWithCurrency = await Promise.all(
        data.map(async (referral) => {
          const commissionSum = await this.commissionRepo
            .createQueryBuilder('c')
            .select('COALESCE(SUM(c.subscriptionAmount), 0)', 'revenue')
            .addSelect('COALESCE(SUM(c.amount), 0)', 'commission')
            .where('c.referralId = :referralId', { referralId: referral.id })
            .andWhere('c.currency = :currency', { currency })
            .getRawOne<{ revenue: string; commission: string }>();

          return {
            ...referral,
            totalRevenueGenerated: parseFloat(commissionSum?.revenue || '0'),
            totalCommissionGenerated: parseFloat(
              commissionSum?.commission || '0',
            ),
          };
        }),
      );
      return { data: referralsWithCurrency, total, page, limit };
    }

    // Add totalCommissionGenerated for all currencies
    const referralsWithCommission = await Promise.all(
      data.map(async (referral) => {
        const commissionSum = await this.commissionRepo
          .createQueryBuilder('c')
          .select('COALESCE(SUM(c.amount), 0)', 'commission')
          .where('c.referralId = :referralId', { referralId: referral.id })
          .getRawOne<{ commission: string }>();

        return {
          ...referral,
          totalCommissionGenerated: parseFloat(
            commissionSum?.commission || '0',
          ),
        };
      }),
    );

    return { data: referralsWithCommission, total, page, limit };
  }

  /**
   * Get paginated commissions for an affiliate
   */
  async getCommissions(
    affiliateId: string,
    page: number,
    limit: number,
    currency?: Currency,
  ) {
    const where: Record<string, any> = { affiliateId };
    if (currency) where.currency = currency;

    const [data, total] = await this.commissionRepo.findAndCount({
      where,
      relations: ['referral', 'referral.referredUser', 'subscription'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit };
  }

  /**
   * Get earnings grouped by plan name (for pie chart)
   */
  async getEarningsByPlan(affiliateId: string, currency?: Currency) {
    const qb = this.commissionRepo
      .createQueryBuilder('c')
      .select('c.planName', 'planName')
      .addSelect('SUM(c.amount)', 'totalEarnings')
      .addSelect('COUNT(*)', 'count')
      .where('c.affiliateId = :affiliateId', { affiliateId });

    if (currency) {
      qb.andWhere('c.currency = :currency', { currency });
    } else {
      qb.addSelect('c.currency', 'currency').addGroupBy('c.currency');
    }

    return qb.groupBy('c.planName').getRawMany();
  }

  /**
   * Get earnings grouped by currency
   */
  async getEarningsByCurrency(affiliateId: string) {
    return this.commissionRepo
      .createQueryBuilder('c')
      .select('c.currency', 'currency')
      .addSelect('SUM(c.amount)', 'totalEarnings')
      .addSelect('COUNT(*)', 'count')
      .where('c.affiliateId = :affiliateId', { affiliateId })
      .groupBy('c.currency')
      .getRawMany();
  }

  /**
   * Get earnings over time with zero-filled period slots.
   *
   * The backend owns the date range — always "current period up to today":
   *   'day'   → this week (Sunday → today), one point per day       (max 7)
   *   'week'  → this month (1st → today),   one point per Sun-week  (max 5)
   *   'month' → this year  (Jan → now),      one point per month    (max 12)
   *
   * Dates are localised to `timezone` so "today" reflects the affiliate's
   * calendar, not the UTC day.  Pass the browser's
   * `Intl.DateTimeFormat().resolvedOptions().timeZone` from the frontend.
   *
   * Returns [] only when every slot resolves to 0 earnings.
   */
  async getEarningsOverTime(
    affiliateId: string,
    _startDate: Date, // kept for API compat; range computed from `now`
    _endDate: Date,
    granularity: 'day' | 'week' | 'month' = 'day',
    currency?: Currency,
    timezone: string = 'UTC',
  ): Promise<{ period: string; earnings: number; subscriptions: number }[]> {
    const now = new Date();

    // ── 0. "Today" in the affiliate's local timezone ─────────────────────────
    // Use Intl.DateTimeFormat to get the local year/month/day without any
    // external library.  We then represent it as a "fake UTC" Date so all
    // subsequent date-arithmetic uses UTC methods (avoids Node.js local-tz drift).
    const {
      year: localYear,
      month: localMonth,
      day: localDay,
      dow: localDow,
    } = getLocalDateParts(now, timezone);

    // ── 1. SQL expression — group by local calendar date/month ───────────────
    // c."createdAt" is stored as UTC (timestamp without time zone from TypeORM).
    // `AT TIME ZONE 'UTC'` makes it a timestamptz, then `AT TIME ZONE :timezone`
    // converts to the affiliate's local time before TO_CHAR extracts the date.
    const byMonth = granularity === 'month';
    const tzExpr = `c."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE :timezone`;
    const dbExpr = byMonth
      ? `TO_CHAR(${tzExpr}, 'YYYY-MM')`
      : `TO_CHAR(${tzExpr}, 'YYYY-MM-DD')`;

    // ── 2. Query window (UTC, +2-day buffer to capture any TZ edge case) ─────
    const DAY_MS = 24 * 60 * 60 * 1000;
    // Local period start as a "fake UTC" date
    let localWindowStart: Date;
    if (granularity === 'day') {
      localWindowStart = new Date(
        Date.UTC(localYear, localMonth, localDay - localDow),
      );
    } else if (granularity === 'week') {
      localWindowStart = new Date(Date.UTC(localYear, localMonth, 1));
    } else {
      localWindowStart = new Date(Date.UTC(localYear, 0, 1));
    }
    const localWindowEnd = new Date(Date.UTC(localYear, localMonth, localDay));
    // Convert fake-UTC → real UTC query bounds (buffer handles ±14h TZ offsets)
    const queryStart = new Date(localWindowStart.getTime() - 2 * DAY_MS);
    const todayEnd = new Date(localWindowEnd.getTime() + 2 * DAY_MS);

    // ── 3. Single aggregated DB query ────────────────────────────────────────
    const qb = this.commissionRepo
      .createQueryBuilder('c')
      .select(dbExpr, 'period')
      .addSelect('COALESCE(SUM(c.amount), 0)', 'earnings')
      .addSelect('COUNT(*)', 'subscriptions')
      .where('c.affiliateId = :affiliateId', { affiliateId })
      .andWhere('c.createdAt BETWEEN :queryStart AND :todayEnd', {
        queryStart,
        todayEnd,
      })
      .setParameter('timezone', timezone);

    if (currency) qb.andWhere('c.currency = :currency', { currency });

    const rawRows = await qb.groupBy(dbExpr).orderBy(dbExpr, 'ASC').getRawMany<{
      period: string;
      earnings: string;
      subscriptions: string;
    }>();

    // ── 4. Build lookup map — keys are already tz-correct strings from TO_CHAR
    const dataMap = new Map<
      string,
      { earnings: number; subscriptions: number }
    >();
    for (const row of rawRows) {
      const key = row.period; // 'YYYY-MM' or 'YYYY-MM-DD', local timezone
      const prev = dataMap.get(key) ?? { earnings: 0, subscriptions: 0 };
      dataMap.set(key, {
        earnings: prev.earnings + parseFloat(row.earnings ?? '0'),
        subscriptions:
          prev.subscriptions + parseInt(row.subscriptions ?? '0', 10),
      });
    }

    // ── 5. Build the full skeleton ───────────────────────────────────────────
    const result: {
      period: string;
      earnings: number;
      subscriptions: number;
    }[] = [];
    const fmtDay = (d: Date) =>
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

    if (granularity === 'day') {
      // Sunday → today (local), one slot per day
      const cur = new Date(
        Date.UTC(localYear, localMonth, localDay - localDow),
      );
      const end = new Date(Date.UTC(localYear, localMonth, localDay));
      while (cur <= end) {
        const key = fmtDay(cur);
        result.push({
          period: key,
          ...(dataMap.get(key) ?? { earnings: 0, subscriptions: 0 }),
        });
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
    } else if (granularity === 'week') {
      // Anchor = Sunday on or before the 1st of the month (local)
      const firstOfMonth = new Date(Date.UTC(localYear, localMonth, 1));
      const dowFirst = firstOfMonth.getUTCDay();
      const anchor = new Date(Date.UTC(localYear, localMonth, 1 - dowFirst));

      // Bucket day-level local dates into their Sunday-week key
      const weekMap = new Map<
        string,
        { earnings: number; subscriptions: number }
      >();
      for (const [dayKey, dayData] of dataMap) {
        // dayKey is 'YYYY-MM-DD' (local date from TO_CHAR)
        const [dy, dm, dd] = dayKey.split('-').map(Number);
        const d = new Date(Date.UTC(dy, dm - 1, dd));
        const sun = new Date(
          Date.UTC(
            d.getUTCFullYear(),
            d.getUTCMonth(),
            d.getUTCDate() - d.getUTCDay(),
          ),
        );
        const wk = fmtDay(sun);
        const prev = weekMap.get(wk) ?? { earnings: 0, subscriptions: 0 };
        weekMap.set(wk, {
          earnings: prev.earnings + dayData.earnings,
          subscriptions: prev.subscriptions + dayData.subscriptions,
        });
      }

      const cur = new Date(anchor);
      const end = new Date(Date.UTC(localYear, localMonth, localDay));
      while (cur <= end) {
        const key = fmtDay(cur);
        result.push({
          period: key,
          ...(weekMap.get(key) ?? { earnings: 0, subscriptions: 0 }),
        });
        cur.setUTCDate(cur.getUTCDate() + 7);
      }
    } else {
      // Jan → current month (local), one slot per month
      for (let m = 0; m <= localMonth; m++) {
        const mm = String(m + 1).padStart(2, '0');
        const key = `${localYear}-${mm}`;
        result.push({
          period: `${localYear}-${mm}-01`,
          ...(dataMap.get(key) ?? { earnings: 0, subscriptions: 0 }),
        });
      }
    }

    // ── 6. Return [] only when there is genuinely nothing to show ────────────
    if (result.every((p) => p.earnings === 0)) return [];

    return result;
  }

  /**
   * Request a withdrawal from pending balance
   */
  async requestWithdrawal(
    affiliateId: string,
    amount: number,
  ): Promise<AffiliatePayout> {
    const profile = await this.affiliateProfileRepo.findOne({
      where: { id: affiliateId },
    });

    if (!profile) {
      throw new BadRequestException('Affiliate profile not found');
    }

    if (amount <= 0) {
      throw new BadRequestException('Withdrawal amount must be greater than 0');
    }

    if (amount > profile.pendingBalance) {
      throw new BadRequestException('Insufficient pending balance');
    }

    const payout = this.affiliatePayoutRepo.create({
      affiliateId,
      amount,
      status: PayoutStatus.PENDING,
    });

    const savedPayout = await this.affiliatePayoutRepo.save(payout);

    // Decrement pending balance
    await this.affiliateProfileRepo.decrement(
      { id: affiliateId },
      'pendingBalance',
      amount,
    );

    await this.loggerService.log({
      action: LogActionTypes.PAYMENT,
      description: 'Affiliate withdrawal requested',
      metadata: {
        affiliateId,
        amount,
        payoutId: savedPayout.id,
      },
    });

    return savedPayout;
  }

  /**
   * Get paginated payout history for an affiliate
   */
  async getPayouts(affiliateId: string, page: number, limit: number) {
    const [data, total] = await this.affiliatePayoutRepo.findAndCount({
      where: { affiliateId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit };
  }

  /**
   * Update affiliate code (custom username-style code)
   */
  /**
   * Check if an affiliate code is available
   * Returns { available: boolean, message?: string }
   */
  async checkCodeAvailability(
    code: string,
    currentAffiliateId?: string,
  ): Promise<{ available: boolean; message?: string }> {
    // Validate format: alphanumeric + hyphens, 4-30 chars
    if (!/^[a-zA-Z0-9-]{4,30}$/.test(code)) {
      return {
        available: false,
        message: 'Code must be 4-30 characters, alphanumeric and hyphens only',
      };
    }

    // Check uniqueness against existing affiliateCode column
    const existingByCode = await this.affiliateProfileRepo.findOne({
      where: { affiliateCode: code },
    });
    if (existingByCode && existingByCode.id !== currentAffiliateId) {
      return {
        available: false,
        message: 'This affiliate code is already taken',
      };
    }

    // Only check against profile IDs if code looks like a UUID (prevent collision with default UUID codes)
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(code)) {
      const existingById = await this.affiliateProfileRepo.findOne({
        where: { id: code },
      });
      if (existingById && existingById.id !== currentAffiliateId) {
        return { available: false, message: 'This code is reserved' };
      }
    }

    return { available: true, message: 'This code is available' };
  }

  async updateAffiliateCode(
    affiliateId: string,
    newCode: string,
  ): Promise<AffiliateProfile> {
    // Validate format: alphanumeric + hyphens, 4-30 chars
    if (!/^[a-zA-Z0-9-]{4,30}$/.test(newCode)) {
      throw new BadRequestException(
        'Affiliate code must be 4-30 characters, alphanumeric and hyphens only',
      );
    }

    // Check uniqueness against existing affiliateCode column
    const existingByCode = await this.affiliateProfileRepo.findOne({
      where: { affiliateCode: newCode },
    });
    if (existingByCode && existingByCode.id !== affiliateId) {
      throw new BadRequestException('This affiliate code is already taken');
    }

    // Only check against profile IDs if code looks like a UUID (prevent collision with default UUID codes)
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(newCode)) {
      const existingById = await this.affiliateProfileRepo.findOne({
        where: { id: newCode },
      });
      if (existingById && existingById.id !== affiliateId) {
        throw new BadRequestException('This code is reserved');
      }
    }

    const profile = await this.affiliateProfileRepo.findOne({
      where: { id: affiliateId },
    });
    if (!profile) {
      throw new BadRequestException('Affiliate profile not found');
    }

    profile.affiliateCode = newCode;
    return await this.affiliateProfileRepo.save(profile);
  }
}
