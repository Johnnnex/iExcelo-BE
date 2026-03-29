/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  forwardRef,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { nanoid } from 'nanoid';
import { SponsorProfile } from './entities/sponsor-profile.entity';
import { SponsorUrl } from './entities/sponsor-url.entity';
import { SponsorStudentInvite } from './entities/sponsor-student-invite.entity';
import { Giveback } from './entities/giveback.entity';
import { UsersService } from '../users/users.service';
import { StudentsService } from '../students/students.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { TransactionsService } from '../subscriptions/services';
import { AffiliatesService } from '../affiliates/affiliates.service';
import { EmailService } from '../email/email.service';
import { LoggerService } from '../logger/logger.service';
import {
  SponsorType,
  SponsorInviteStatus,
  LogActionTypes,
  UserType,
  AuthProvider,
  GivebackType,
  GivebackStatus,
  PaymentProvider,
  Currency,
  TransactionType,
} from '../../types';

@Injectable()
export class SponsorsService {
  constructor(
    @InjectRepository(SponsorProfile)
    private sponsorProfileRepo: Repository<SponsorProfile>,
    @InjectRepository(SponsorUrl)
    private sponsorUrlRepo: Repository<SponsorUrl>,
    @InjectRepository(SponsorStudentInvite)
    private sponsorInviteRepo: Repository<SponsorStudentInvite>,
    @InjectRepository(Giveback)
    private givebackRepo: Repository<Giveback>,
    private configService: ConfigService,
    private usersService: UsersService,
    @Inject(forwardRef(() => StudentsService))
    private studentsService: StudentsService,
    private subscriptionsService: SubscriptionsService,
    private transactionsService: TransactionsService,
    private affiliatesService: AffiliatesService,
    private emailService: EmailService,
    private loggerService: LoggerService,
  ) {}

  // ─── Profile ──────────────────────────────────────────────────────────────

  async createSponsorProfile(data: {
    userId: string;
    sponsorType?: SponsorType;
    companyName?: string;
    phoneNumber?: string;
    countryCode?: string;
  }): Promise<SponsorProfile> {
    const profile = this.sponsorProfileRepo.create({
      userId: data.userId,
      sponsorType: data.sponsorType || SponsorType.INDIVIDUAL,
      companyName: data.companyName,
    });
    const savedProfile = await this.sponsorProfileRepo.save(profile);

    await this.loggerService.log({
      userId: data.userId,
      action: LogActionTypes.CREATE,
      description: 'Sponsor profile created',
      metadata: {
        profileId: savedProfile.id,
        sponsorType: savedProfile.sponsorType,
      },
    });

    return savedProfile;
  }

  async findByUserId(userId: string): Promise<SponsorProfile | null> {
    return this.sponsorProfileRepo.findOne({ where: { userId } });
  }

  async findByProfileId(profileId: string): Promise<SponsorProfile | null> {
    return this.sponsorProfileRepo.findOne({ where: { id: profileId } });
  }

  // ─── Add Student Manually ─────────────────────────────────────────────────

  async addStudentManually(
    sponsorUserId: string,
    data: {
      email: string;
      firstName: string;
      lastName: string;
      phoneNumber?: string;
      examTypeId: string;
    },
  ): Promise<{ message: string }> {
    // Find the sponsor's profile
    const sponsorProfile = await this.findByUserId(sponsorUserId);
    if (!sponsorProfile)
      throw new NotFoundException('Sponsor profile not found');

    // Guard: email must not already exist on iExcelo
    const existingUser = await this.usersService.findByEmail(data.email);
    if (existingUser) {
      throw new BadRequestException(
        'An account with this email already exists on iExcelo.',
      );
    }

    // Create the user account (inactive — student must activate via email link)
    const user = await this.usersService.create({
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      phoneNumber: data.phoneNumber,
      role: UserType.STUDENT,
      provider: AuthProvider.LOCAL,
      emailVerified: true, // Sponsor vouches for the email
      isActive: false, // Student must activate
      password: null, // Set during activation
    } as any);

    // Compute sponsor display name (companyName for orgs, full name for individuals)
    const sponsorUser = await this.usersService.findById(sponsorUserId);
    const sponsorDisplayName =
      sponsorProfile.companyName ||
      `${sponsorUser?.firstName ?? ''} ${sponsorUser?.lastName ?? ''}`.trim() ||
      'Your Sponsor';

    // Create student profile (sponsored)
    await this.studentsService.createStudentProfile({
      userId: user.id,
      examTypeId: data.examTypeId,
      isSponsored: true,
      sponsorId: sponsorProfile.id,
      sponsorDisplayName,
    });

    // Create affiliate profile so sponsored students can access Referrals & Invites
    await this.affiliatesService.createAffiliateProfile({
      userId: user.id,
      firstName: data.firstName,
      lastName: data.lastName,
      phoneNumber: data.phoneNumber,
    });

    // Generate activation token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7-day window

    // Store hashed token in invite record
    const invite = this.sponsorInviteRepo.create({
      sponsorId: sponsorProfile.id,
      studentEmail: data.email,
      examTypeId: data.examTypeId,
      token: hashedToken,
      status: SponsorInviteStatus.PENDING,
      expiresAt,
    });
    await this.sponsorInviteRepo.save(invite);

    // Send activation email to student (raw token goes in URL)
    await this.emailService.sendSponsoredActivationEmail(
      data.email,
      data.firstName,
      rawToken,
      sponsorProfile.companyName || 'Your sponsor',
    );

    // Increment totalStudentsSponsored on profile
    await this.sponsorProfileRepo.update(
      { id: sponsorProfile.id },
      { totalStudentsSponsored: () => '"totalStudentsSponsored" + 1' },
    );

    await this.loggerService.log({
      userId: sponsorUserId,
      action: LogActionTypes.CREATE,
      description: `Sponsor manually added student: ${data.email}`,
      metadata: { sponsorId: sponsorProfile.id, studentEmail: data.email },
    });

    return { message: 'Student account created. Activation email sent.' };
  }

  // ─── Sponsor URLs ─────────────────────────────────────────────────────────

  async createSponsorUrl(
    sponsorUserId: string,
    data: { label: string; maxUses?: number | null },
  ): Promise<SponsorUrl> {
    const sponsorProfile = await this.findByUserId(sponsorUserId);
    if (!sponsorProfile)
      throw new NotFoundException('Sponsor profile not found');

    // Generate a short unique code
    const code = nanoid(10).toUpperCase();

    const url = this.sponsorUrlRepo.create({
      sponsorId: sponsorProfile.id,
      label: data.label,
      code,
      maxUses: data.maxUses ?? null,
      usedCount: 0,
      isDisabled: false,
    });

    return this.sponsorUrlRepo.save(url);
  }

  async getSponsorUrls(sponsorUserId: string): Promise<SponsorUrl[]> {
    const sponsorProfile = await this.findByUserId(sponsorUserId);
    if (!sponsorProfile)
      throw new NotFoundException('Sponsor profile not found');

    return this.sponsorUrlRepo.find({
      where: { sponsorId: sponsorProfile.id },
      order: { createdAt: 'DESC' },
    });
  }

  async toggleSponsorUrl(
    sponsorUserId: string,
    urlId: string,
  ): Promise<SponsorUrl> {
    const sponsorProfile = await this.findByUserId(sponsorUserId);
    if (!sponsorProfile)
      throw new NotFoundException('Sponsor profile not found');

    const url = await this.sponsorUrlRepo.findOne({
      where: { id: urlId, sponsorId: sponsorProfile.id },
    });
    if (!url) throw new NotFoundException('Sponsor URL not found');

    url.isDisabled = !url.isDisabled;
    return this.sponsorUrlRepo.save(url);
  }

  /** Validate a sponsor URL code before allowing signup. Returns the URL or throws. */
  async validateSponsorCode(code: string): Promise<SponsorUrl> {
    const url = await this.sponsorUrlRepo.findOne({
      where: { code },
      relations: ['sponsor'],
    });
    if (!url) throw new NotFoundException('Invalid sponsor link.');
    if (url.isDisabled)
      throw new ForbiddenException('This sponsor link has been disabled.');
    if (url.maxUses !== null && url.usedCount >= url.maxUses)
      throw new ForbiddenException(
        'This sponsor link has reached its maximum uses.',
      );
    return url;
  }

  /** Increment totalStudentsSponsored on a sponsor profile. */
  async incrementStudentsSponsored(sponsorProfileId: string): Promise<void> {
    await this.sponsorProfileRepo.update(
      { id: sponsorProfileId },
      { totalStudentsSponsored: () => '"totalStudentsSponsored" + 1' },
    );
  }

  /** Increment usedCount on a sponsor URL after a successful signup. */
  async trackSponsorUrlUsage(urlId: string): Promise<void> {
    await this.sponsorUrlRepo.update(
      { id: urlId },
      { usedCount: () => '"usedCount" + 1' },
    );
  }

  // ─── Invite Lifecycle ─────────────────────────────────────────────────────

  async findInviteByToken(
    hashedToken: string,
  ): Promise<SponsorStudentInvite | null> {
    return this.sponsorInviteRepo.findOne({ where: { token: hashedToken } });
  }

  async markInviteAccepted(inviteId: string): Promise<void> {
    await this.sponsorInviteRepo.update(
      { id: inviteId },
      { status: SponsorInviteStatus.ACCEPTED, acceptedAt: new Date() },
    );
  }

  // ─── Students ─────────────────────────────────────────────────────────────

  async getStudents(sponsorUserId: string, page: number, limit: number) {
    const sponsorProfile = await this.findByUserId(sponsorUserId);
    if (!sponsorProfile)
      throw new NotFoundException('Sponsor profile not found');

    const { students, total } =
      await this.studentsService.findSponsoredStudents(
        sponsorProfile.id,
        page,
        limit,
      );

    // Attach current active subscription per student
    const studentIds = students.map((s) => s.id);
    const subscriptionMap = new Map<string, any>();

    if (studentIds.length > 0) {
      // Pull all active sponsored subscriptions for these students in one query
      const { subscriptions } =
        await this.subscriptionsService.getSponsoredSubscriptions(
          sponsorProfile.id,
          1,
          1000,
        );
      for (const sub of subscriptions) {
        if (!subscriptionMap.has(sub.studentId)) {
          subscriptionMap.set(sub.studentId, sub);
        }
      }
    }

    const rows = students.map((s) => ({
      id: s.id,
      userId: s.userId,
      firstName: (s as any).user?.firstName ?? '',
      lastName: (s as any).user?.lastName ?? '',
      email: (s as any).user?.email ?? '',
      isActive: (s as any).user?.isActive ?? false,
      isSponsored: s.isSponsored,
      defaultExamTypeId: s.defaultExamTypeId,
      createdAt: s.createdAt,
      subscription: subscriptionMap.get(s.id) ?? null,
    }));

    return { students: rows, total };
  }

  async getStudentStats(sponsorUserId: string) {
    const sponsorProfile = await this.findByUserId(sponsorUserId);
    if (!sponsorProfile)
      throw new NotFoundException('Sponsor profile not found');

    const [total, active, expiringSoon, monthlyStats] = await Promise.all([
      this.studentsService.countSponsoredStudents(sponsorProfile.id),
      this.studentsService.countActiveSponsoredStudents(sponsorProfile.id),
      this.subscriptionsService.countExpiringSponsoredSubscriptions(
        sponsorProfile.id,
        10,
      ),
      this.studentsService.getSponsoredStudentMonthlyStats(sponsorProfile.id),
    ]);

    // Percentage change: enrolled this month vs last month
    let enrollmentChange = 0;
    if (monthlyStats.lastMonth === 0 && monthlyStats.thisMonth > 0) {
      enrollmentChange = 100;
    } else if (monthlyStats.lastMonth > 0) {
      enrollmentChange = Math.round(
        ((monthlyStats.thisMonth - monthlyStats.lastMonth) /
          monthlyStats.lastMonth) *
          100,
      );
    }

    const conversionRate = total > 0 ? Math.round((active / total) * 100) : 0;

    return {
      total,
      active,
      expiringSoon,
      enrollmentChange,
      conversionRate,
      thisMonthEnrolled: monthlyStats.thisMonth,
      lastMonthEnrolled: monthlyStats.lastMonth,
    };
  }

  // ─── Dashboard ────────────────────────────────────────────────────────────

  async getDashboard(sponsorUserId: string) {
    const sponsorProfile = await this.findByUserId(sponsorUserId);
    if (!sponsorProfile)
      throw new NotFoundException('Sponsor profile not found');

    const [
      totalGivebacks,
      givebacksChange,
      studentStats,
      examStats,
      recentGivebacks,
      recentStudents,
    ] = await Promise.all([
      this.subscriptionsService.getSponsoredGivebackCount(sponsorProfile.id),
      this.subscriptionsService.getGivebacksMonthlyChange(sponsorProfile.id),
      this.getStudentStats(sponsorUserId),
      this.studentsService.getSponsoredExamStats(sponsorProfile.id),
      this.subscriptionsService.getRecentSponsoredGivebacks(
        sponsorProfile.id,
        4,
      ),
      this.studentsService.getRecentSponsoredStudents(sponsorProfile.id, 5),
    ]);

    // Populate subscription data on recent givebacks (first linked sub for labels)
    const populatedGivebacks = await Promise.all(
      recentGivebacks.map(async (g) => {
        const subs =
          await this.subscriptionsService.findSubscriptionsByGivebackId(g.id);
        return { ...g, subscription: subs[0] ?? null };
      }),
    );

    return {
      totalGivebacks,
      givebacksChange,
      studentsEnrolled: studentStats.total,
      activeStudents: studentStats.active,
      expiringSoon: studentStats.expiringSoon,
      enrollmentChange: studentStats.enrollmentChange,
      thisMonthEnrolled: studentStats.thisMonthEnrolled,
      examsCompleted: examStats.totalExams,
      avgScore: examStats.avgScore,
      recentGivebacks: populatedGivebacks,
      recentStudents: recentStudents.map((s) => ({
        id: s.id,
        firstName: (s as any).user?.firstName ?? '',
        lastName: (s as any).user?.lastName ?? '',
        email: (s as any).user?.email ?? '',
        isActive: (s as any).user?.isActive ?? false,
        defaultExamTypeId: s.defaultExamTypeId,
        createdAt: s.createdAt,
      })),
    };
  }

  // ─── Student Analytics (sponsor POV) ──────────────────────────────────────

  /** Verify student belongs to sponsor, then return their dashboard data. */
  async getStudentDashboard(
    sponsorUserId: string,
    studentProfileId: string,
    examTypeId?: string,
    granularity: 'day' | 'week' | 'month' = 'month',
    timezone: string = 'UTC',
  ) {
    const sponsorProfile = await this.findByUserId(sponsorUserId);
    if (!sponsorProfile)
      throw new NotFoundException('Sponsor profile not found');
    const student = await this.studentsService.findSponsoredStudentById(
      sponsorProfile.id,
      studentProfileId,
    );
    return this.studentsService.getStudentDashboard(
      student.userId,
      examTypeId,
      granularity,
      timezone,
    );
  }

  /** Chart 1 — Subject scores (date range) for a sponsored student. */
  async getStudentAnalyticsSubjectScores(
    sponsorUserId: string,
    studentProfileId: string,
    examTypeId: string,
    startDate?: string,
    endDate?: string,
  ) {
    const sponsorProfile = await this.findByUserId(sponsorUserId);
    if (!sponsorProfile)
      throw new NotFoundException('Sponsor profile not found');
    const student = await this.studentsService.findSponsoredStudentById(
      sponsorProfile.id,
      studentProfileId,
    );
    return this.studentsService.getAnalyticsSubjectScores(
      student.id,
      examTypeId,
      startDate,
      endDate,
    );
  }

  /** Chart 2 — Progress over time for a sponsored student. */
  async getStudentAnalyticsProgress(
    sponsorUserId: string,
    studentProfileId: string,
    examTypeId: string,
    granularity: 'day' | 'week' | 'month' = 'month',
    timezone: string = 'UTC',
  ) {
    const sponsorProfile = await this.findByUserId(sponsorUserId);
    if (!sponsorProfile)
      throw new NotFoundException('Sponsor profile not found');
    const student = await this.studentsService.findSponsoredStudentById(
      sponsorProfile.id,
      studentProfileId,
    );
    return this.studentsService.getAnalyticsProgressOverTime(
      student.id,
      examTypeId,
      granularity,
      timezone,
    );
  }

  /** Chart 3 — Question distribution for a sponsored student. */
  async getStudentAnalyticsQuestionDistribution(
    sponsorUserId: string,
    studentProfileId: string,
    examTypeId: string,
  ) {
    const sponsorProfile = await this.findByUserId(sponsorUserId);
    if (!sponsorProfile)
      throw new NotFoundException('Sponsor profile not found');
    const student = await this.studentsService.findSponsoredStudentById(
      sponsorProfile.id,
      studentProfileId,
    );
    return this.studentsService.getAnalyticsQuestionDistribution(
      student.id,
      examTypeId,
    );
  }

  /** Chart 4 — Student ranking for a sponsored student. */
  async getStudentAnalyticsRanking(
    sponsorUserId: string,
    studentProfileId: string,
    examTypeId: string,
    startDate?: string,
    endDate?: string,
  ) {
    const sponsorProfile = await this.findByUserId(sponsorUserId);
    if (!sponsorProfile)
      throw new NotFoundException('Sponsor profile not found');
    const student = await this.studentsService.findSponsoredStudentById(
      sponsorProfile.id,
      studentProfileId,
    );
    return this.studentsService.getAnalyticsStudentRanking(
      student.id,
      examTypeId,
      startDate,
      endDate,
    );
  }

  /** Chart 5 — Subject attempts for a sponsored student. */
  async getStudentAnalyticsSubjectAttempts(
    sponsorUserId: string,
    studentProfileId: string,
    examTypeId: string,
    granularity: 'day' | 'week' | 'month' = 'month',
    period?: string,
    timezone: string = 'UTC',
  ) {
    const sponsorProfile = await this.findByUserId(sponsorUserId);
    if (!sponsorProfile)
      throw new NotFoundException('Sponsor profile not found');
    const student = await this.studentsService.findSponsoredStudentById(
      sponsorProfile.id,
      studentProfileId,
    );
    return this.studentsService.getAnalyticsSubjectAttempts(
      student.id,
      examTypeId,
      granularity,
      period,
      timezone,
    );
  }

  // ─── Givebacks ────────────────────────────────────────────────────────────

  async getGivebackPageStats(sponsorUserId: string) {
    const sponsorProfile = await this.findByUserId(sponsorUserId);
    if (!sponsorProfile)
      throw new NotFoundException('Sponsor profile not found');
    return this.subscriptionsService.getGivebackPageStats(sponsorProfile.id);
  }

  async getGivebacks(
    sponsorUserId: string,
    page: number,
    limit: number,
    status?: GivebackStatus,
  ) {
    const sponsorProfile = await this.findByUserId(sponsorUserId);
    if (!sponsorProfile)
      throw new NotFoundException('Sponsor profile not found');

    return this.subscriptionsService.getSponsoredGivebacks(
      sponsorProfile.id,
      page,
      limit,
      status,
    );
  }

  async getGivebackDetail(sponsorUserId: string, givebackId: string) {
    const sponsorProfile = await this.findByUserId(sponsorUserId);
    if (!sponsorProfile)
      throw new NotFoundException('Sponsor profile not found');

    const detail = await this.subscriptionsService.getGivebackDetail(
      sponsorProfile.id,
      givebackId,
    );
    if (!detail) throw new NotFoundException('Giveback not found');
    return detail;
  }

  /**
   * Initiate a sponsor subscription giveback:
   * - Same plan + exam type for all selected students (one Paystack charge for the total)
   * - Returns authorizationUrl, reference, givebackId, and any per-student conflicts
   */
  async initiateSponsorSubscriptionGiveback(
    sponsorUserId: string,
    data: {
      studentIds: string[]; // StudentProfile IDs
      examTypeId: string;
      planId: string;
      planPriceId: string;
      customerEmail: string;
      callbackUrl: string;
    },
  ): Promise<{
    authorizationUrl: string;
    reference: string;
    givebackId: string;
    eligibleCount: number;
    conflicts: Array<{ studentId: string; reason: string }>;
  }> {
    const paystackSecretKey = this.configService.get<string>(
      'PAYSTACK_SECRET_KEY',
    );
    if (!paystackSecretKey)
      throw new BadRequestException('Paystack is not configured');

    const sponsorProfile = await this.findByUserId(sponsorUserId);
    if (!sponsorProfile)
      throw new NotFoundException('Sponsor profile not found');

    if (!data.studentIds.length)
      throw new BadRequestException('No students selected');

    // Validate plan + price
    const plan = await this.subscriptionsService.findPlanById(data.planId);
    if (!plan) throw new BadRequestException('Plan not found');

    const planPrice = await this.subscriptionsService.findPlanPriceById(
      data.planPriceId,
    );
    if (!planPrice) throw new BadRequestException('Plan price not found');

    // Batch validation — 2 queries instead of N×2 sequential
    const validProfiles = await this.studentsService.findSponsoredStudentsByIds(
      sponsorProfile.id,
      data.studentIds,
    );
    const activeSubs = validProfiles.length
      ? await this.subscriptionsService.findActiveSubscriptionsForStudents(
          validProfiles.map((p) => p.id),
          data.examTypeId,
        )
      : [];

    const validProfileMap = new Map(validProfiles.map((p) => [p.id, p]));
    const alreadySubscribedIds = new Set(activeSubs.map((s) => s.studentId));

    const conflicts: Array<{ studentId: string; reason: string }> = [];
    const eligibleProfiles: Array<{ id: string }> = [];

    for (const studentId of data.studentIds) {
      const profile = validProfileMap.get(studentId);
      if (!profile) {
        conflicts.push({
          studentId,
          reason: 'Student not found or does not belong to you',
        });
        continue;
      }
      if (alreadySubscribedIds.has(studentId)) {
        conflicts.push({
          studentId,
          reason:
            'Student already has an active subscription for this exam type',
        });
        continue;
      }
      eligibleProfiles.push(profile);
    }

    if (!eligibleProfiles.length) {
      throw new BadRequestException(
        'All selected students have conflicts. No eligible students.',
      );
    }

    const eligibleCount = eligibleProfiles.length;
    const totalAmount = planPrice.amount * eligibleCount;

    // Create Giveback record (PENDING — activates after payment verification)
    const giveback = this.givebackRepo.create({
      sponsorId: sponsorProfile.id,
      type: GivebackType.SUBSCRIPTION,
      amount: totalAmount,
      currency: planPrice.currency,
      studentCount: eligibleCount,
    });
    const savedGiveback = await this.givebackRepo.save(giveback);

    // Create PENDING Subscription for each eligible student (parallel)
    await Promise.all(
      eligibleProfiles.map((profile) =>
        this.subscriptionsService.createSubscription({
          studentId: profile.id,
          examTypeId: data.examTypeId,
          planId: data.planId,
          planPriceId: data.planPriceId,
          sponsorId: sponsorProfile.id,
          givebackId: savedGiveback.id,
          provider: PaymentProvider.PAYSTACK,
          currency: planPrice.currency as Currency,
          amount: planPrice.amount,
        }),
      ),
    );

    // Initialize Paystack one-time transaction (NO plan code = not recurring)
    const response = await fetch(
      'https://api.paystack.co/transaction/initialize',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${paystackSecretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: data.customerEmail,
          amount: Math.round(totalAmount * 100), // kobo
          currency: planPrice.currency,
          callback_url: data.callbackUrl,
          metadata: {
            givebackId: savedGiveback.id,
            sponsorId: sponsorProfile.id,
            planId: data.planId,
            examTypeId: data.examTypeId,
            studentCount: eligibleCount,
            custom_fields: [
              {
                display_name: 'Plan',
                variable_name: 'plan_name',
                value: plan.name,
              },
              {
                display_name: 'Students',
                variable_name: 'student_count',
                value: String(eligibleCount),
              },
            ],
          },
        }),
      },
    );

    const result = (await response.json()) as {
      status: boolean;
      data?: { authorization_url: string; reference: string };
      message?: string;
    };

    if (!result.status || !result.data) {
      // Cleanup: delete the pending giveback and its subscriptions on Paystack failure
      await this.subscriptionsService.cancelPendingGivebackSubscriptions(
        savedGiveback.id,
      );
      await this.givebackRepo.delete({ id: savedGiveback.id });
      throw new BadRequestException(
        result.message || 'Failed to initialize Paystack transaction',
      );
    }

    await this.loggerService.log({
      userId: sponsorUserId,
      action: LogActionTypes.CREATE,
      description: `Sponsor initiated giveback for ${eligibleCount} student(s)`,
      metadata: {
        givebackId: savedGiveback.id,
        sponsorId: sponsorProfile.id,
        reference: result.data.reference,
        studentCount: eligibleCount,
      },
    });

    return {
      authorizationUrl: result.data.authorization_url,
      reference: result.data.reference,
      givebackId: savedGiveback.id,
      eligibleCount,
      conflicts,
    };
  }

  /**
   * Verify a sponsor giveback payment by Paystack reference.
   * Activates all PENDING subscriptions linked to the giveback.
   */
  async verifySponsorGiveback(
    sponsorUserId: string,
    reference: string,
  ): Promise<{
    success: boolean;
    givebackId?: string;
    activatedCount: number;
  }> {
    const paystackSecretKey = this.configService.get<string>(
      'PAYSTACK_SECRET_KEY',
    );
    if (!paystackSecretKey)
      throw new BadRequestException('Paystack is not configured');

    const sponsorProfile = await this.findByUserId(sponsorUserId);
    if (!sponsorProfile)
      throw new NotFoundException('Sponsor profile not found');

    // Verify with Paystack
    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      { headers: { Authorization: `Bearer ${paystackSecretKey}` } },
    );

    const result = (await response.json()) as {
      status: boolean;
      data?: {
        status: string;
        metadata?: { givebackId?: string; sponsorId?: string };
      };
      message?: string;
    };

    if (!result.status || result.data?.status !== 'success') {
      return { success: false, activatedCount: 0 };
    }

    const givebackId = result.data?.metadata?.givebackId;
    if (!givebackId) return { success: false, activatedCount: 0 };

    // Confirm the giveback belongs to this sponsor
    const giveback = await this.givebackRepo.findOne({
      where: { id: givebackId, sponsorId: sponsorProfile.id },
    });
    if (!giveback) throw new NotFoundException('Giveback not found');

    // Idempotency guard — already processed, return current activated count
    if (giveback.status === GivebackStatus.ACTIVE) {
      const existing =
        await this.subscriptionsService.findSubscriptionsByGivebackId(
          givebackId,
        );
      return { success: true, givebackId, activatedCount: existing.length };
    }

    // Activate all pending subscriptions linked to this giveback
    const subscriptions =
      await this.subscriptionsService.findSubscriptionsByGivebackId(givebackId);
    let activatedCount = 0;

    for (const sub of subscriptions) {
      try {
        await this.subscriptionsService.activateSubscription(sub.id);
        activatedCount++;

        // Record a transaction per student for this sponsorship payment
        await this.transactionsService.create({
          studentId: sub.studentId,
          sponsorId: sponsorProfile.id,
          subscriptionId: sub.id,
          type: TransactionType.SPONSORSHIP,
          amount: sub.amountPaid,
          currency: sub.currency,
          provider: PaymentProvider.PAYSTACK,
          providerTransactionId: reference,
        });
      } catch {
        // Continue — don't fail the whole batch for one student
      }
    }

    // Stamp giveback status + endDate from the first activated subscription.
    // All students in a batch share the same plan/duration so they all expire together.
    const firstActivated =
      await this.subscriptionsService.findFirstActivatedSubForGiveback(
        givebackId,
      );
    await this.givebackRepo.update(
      { id: givebackId },
      {
        status: GivebackStatus.ACTIVE,
        ...(firstActivated?.endDate ? { endDate: firstActivated.endDate } : {}),
      },
    );

    await this.loggerService.log({
      userId: sponsorUserId,
      action: LogActionTypes.UPDATE,
      description: `Sponsor giveback verified — ${activatedCount} subscription(s) activated`,
      metadata: { givebackId, sponsorId: sponsorProfile.id, activatedCount },
    });

    return { success: true, givebackId, activatedCount };
  }

  /**
   * Initiate a follow-up (resub) giveback for an existing batch.
   * - Sponsor can pass a subset of the original studentIds (removes the rest)
   * - Sponsor can change examTypeId and/or plan for the new sub
   * - New subs are stacked: startDate = original sub's endDate + 1 day (no cron needed)
   * - Only students whose current ACTIVE sub expires within 10 days are eligible
   */
  async initiateResubGiveback(
    sponsorUserId: string,
    data: {
      originalGivebackId: string;
      studentIds: string[]; // Subset to keep
      examTypeId: string;
      planId: string;
      planPriceId: string;
      customerEmail: string;
      callbackUrl: string;
    },
  ): Promise<{
    authorizationUrl: string;
    reference: string;
    newGivebackId: string;
    eligibleCount: number;
    conflicts: Array<{ studentId: string; reason: string }>;
  }> {
    const paystackSecretKey = this.configService.get<string>(
      'PAYSTACK_SECRET_KEY',
    );
    if (!paystackSecretKey)
      throw new BadRequestException('Paystack is not configured');

    const sponsorProfile = await this.findByUserId(sponsorUserId);
    if (!sponsorProfile)
      throw new NotFoundException('Sponsor profile not found');

    // Verify the original giveback belongs to this sponsor
    const originalGiveback = await this.givebackRepo.findOne({
      where: { id: data.originalGivebackId, sponsorId: sponsorProfile.id },
    });
    if (!originalGiveback)
      throw new NotFoundException('Original giveback not found');
    if (originalGiveback.hasResubbed) {
      throw new BadRequestException(
        'This giveback has already been resubscribed',
      );
    }

    const plan = await this.subscriptionsService.findPlanById(data.planId);
    if (!plan) throw new BadRequestException('Plan not found');

    const planPrice = await this.subscriptionsService.findPlanPriceById(
      data.planPriceId,
    );
    if (!planPrice) throw new BadRequestException('Plan price not found');

    // Get all ACTIVE subs from the original giveback to determine each student's endDate
    const activeSubs =
      await this.subscriptionsService.findActiveSubsByGivebackId(
        data.originalGivebackId,
      );
    const activeSubMap = new Map(activeSubs.map((s) => [s.studentId, s]));

    const now = new Date();
    const in10Days = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);

    const conflicts: Array<{ studentId: string; reason: string }> = [];
    const eligible: string[] = [];

    for (const studentId of data.studentIds) {
      const activeSub = activeSubMap.get(studentId);
      if (!activeSub) {
        conflicts.push({
          studentId,
          reason:
            'Student does not have an active subscription from this giveback',
        });
        continue;
      }
      if (activeSub.endDate > in10Days) {
        conflicts.push({
          studentId,
          reason:
            'Current subscription expires in more than 10 days — too early to resub',
        });
        continue;
      }
      eligible.push(studentId);
    }

    if (!eligible.length) {
      throw new BadRequestException(
        'No eligible students for resub. All have conflicts.',
      );
    }

    const eligibleCount = eligible.length;
    const totalAmount = planPrice.amount * eligibleCount;

    // Create the new Giveback record (PENDING until payment verified)
    const newGiveback = this.givebackRepo.create({
      sponsorId: sponsorProfile.id,
      type: GivebackType.SUBSCRIPTION,
      amount: totalAmount,
      currency: planPrice.currency as Currency,
      studentCount: eligibleCount,
      parentGivebackId: data.originalGivebackId,
    });
    const savedNewGiveback = await this.givebackRepo.save(newGiveback);

    // Create PENDING subs for each eligible student.
    // Stacking (startDate = existing endDate + 1) is auto-detected in activateSubscription().
    await Promise.all(
      eligible.map((studentId) =>
        this.subscriptionsService.createSubscription({
          studentId,
          examTypeId: data.examTypeId,
          planId: data.planId,
          planPriceId: data.planPriceId,
          sponsorId: sponsorProfile.id,
          givebackId: savedNewGiveback.id,
          provider: PaymentProvider.PAYSTACK,
          currency: planPrice.currency as Currency,
          amount: planPrice.amount,
        }),
      ),
    );

    // Initialize Paystack transaction
    const response = await fetch(
      'https://api.paystack.co/transaction/initialize',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${paystackSecretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: data.customerEmail,
          amount: Math.round(totalAmount * 100),
          currency: planPrice.currency,
          callback_url: data.callbackUrl,
          metadata: {
            givebackId: savedNewGiveback.id,
            sponsorId: sponsorProfile.id,
            planId: data.planId,
            examTypeId: data.examTypeId,
            studentCount: eligibleCount,
            isResub: true,
            originalGivebackId: data.originalGivebackId,
          },
        }),
      },
    );

    const result = (await response.json()) as {
      status: boolean;
      data?: { authorization_url: string; reference: string };
      message?: string;
    };

    if (!result.status || !result.data) {
      await this.subscriptionsService.cancelPendingGivebackSubscriptions(
        savedNewGiveback.id,
      );
      await this.givebackRepo.delete({ id: savedNewGiveback.id });
      throw new BadRequestException(
        result.message || 'Failed to initialize Paystack transaction',
      );
    }

    // Mark original giveback as resubbed (prevents double-resubbing)
    await this.subscriptionsService.markGivebackResubbed(
      data.originalGivebackId,
    );

    await this.loggerService.log({
      userId: sponsorUserId,
      action: LogActionTypes.CREATE,
      description: `Sponsor initiated resub giveback for ${eligibleCount} student(s)`,
      metadata: {
        originalGivebackId: data.originalGivebackId,
        newGivebackId: savedNewGiveback.id,
        sponsorId: sponsorProfile.id,
        reference: result.data.reference,
        eligibleCount,
      },
    });

    return {
      authorizationUrl: result.data.authorization_url,
      reference: result.data.reference,
      newGivebackId: savedNewGiveback.id,
      eligibleCount,
      conflicts,
    };
  }

  /** Return givebacks with active subs expiring within 10 days that haven't been resubbed. */
  async getExpiringSoonGivebacks(sponsorUserId: string): Promise<any[]> {
    const sponsorProfile = await this.findByUserId(sponsorUserId);
    if (!sponsorProfile)
      throw new NotFoundException('Sponsor profile not found');
    return this.subscriptionsService.getExpiringSoonGivebacks(
      sponsorProfile.id,
    );
  }
}
