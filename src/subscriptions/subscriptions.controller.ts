/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionPlansService, CheckoutService } from './services';
import { InitiateSubscriptionDto, UpgradeSubscriptionDto } from './dto';
import { Public } from '../common/decorators';
import { JwtAuthGuard } from '../common/guards';
import { User } from '../users/entities/user.entity';
import { PaymentProvider, SubscriptionStatus } from '../../types';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly plansService: SubscriptionPlansService,
    private readonly checkoutService: CheckoutService,
  ) {}

  // === PUBLIC ROUTES ===

  /**
   * Get available plans for an exam type
   * GET /subscriptions/plans?examTypeId=xxx
   */
  @Public()
  @Get('plans')
  async getPlans(@Query('examTypeId') examTypeId: string) {
    const plans = await this.plansService.findByExamType(examTypeId);
    return {
      success: true,
      message: 'Plans retrieved successfully',
      data: plans,
    };
  }

  /**
   * Get checkout info with automatic IP-based region detection
   * GET /subscriptions/checkout-info?examTypeId=xxx
   * Optional: &region=NG (override auto-detection)
   */
  @Public()
  @Get('checkout-info')
  async getCheckoutInfo(
    @Query('examTypeId') examTypeId: string,
    @Query('region') region: string | undefined,
    @Req() req: Request,
  ) {
    // If region is provided, use it directly
    if (region) {
      const checkoutInfo = await this.subscriptionsService.getCheckoutInfo(
        examTypeId,
        region,
      );
      return {
        success: true,
        message: 'Checkout info retrieved successfully',
        data: { region, ...checkoutInfo },
      };
    }

    // Auto-detect region from IP
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      '127.0.0.1';

    const checkoutInfo = await this.subscriptionsService.getCheckoutInfoFromIp(
      examTypeId,
      ipAddress,
    );

    return {
      success: true,
      message: 'Checkout info retrieved successfully',
      data: checkoutInfo,
    };
  }

  /**
   * Get available currencies with IP-based default detection
   * GET /subscriptions/available-currencies
   * Returns distinct active currencies and the default based on caller's IP
   */
  @Public()
  @Get('available-currencies')
  async getAvailableCurrencies(@Req() req: Request) {
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      '127.0.0.1';

    const result =
      await this.subscriptionsService.getAvailableCurrencies(ipAddress);

    return {
      success: true,
      message: 'Available currencies retrieved',
      data: result,
    };
  }

  // === AUTHENTICATED ROUTES ===

  /**
   * Create a checkout session for subscription
   * POST /subscriptions/checkout
   */
  @UseGuards(JwtAuthGuard)
  @Post('checkout')
  async createCheckout(
    @Body() dto: InitiateSubscriptionDto,
    @Req() req: Request & { user: User },
  ) {
    const studentId = req.user.studentProfile?.id;
    if (!studentId) {
      throw new BadRequestException('Student profile not found');
    }

    // Get checkout info for the region to determine provider and currency
    const checkoutInfo = await this.subscriptionsService.getCheckoutInfo(
      dto.examTypeId,
      dto.region,
    );

    const baseUrl =
      dto.redirectUrl || req.headers.origin || 'http://localhost:3001';
    const successUrl = `${baseUrl}/student/upgrade/confirmed`;
    const cancelUrl = `${baseUrl}/student/upgrade?examTypeId=${dto.examTypeId}`;

    if (checkoutInfo.provider === PaymentProvider.STRIPE) {
      const result = await this.checkoutService.createStripeCheckoutSession({
        studentId,
        examTypeId: dto.examTypeId,
        planId: dto.planId,
        currency: checkoutInfo.currency,
        successUrl,
        cancelUrl,
        customerEmail: req.user.email,
      });

      return {
        success: true,
        message: 'Stripe checkout session created',
        data: {
          provider: 'stripe',
          sessionId: result.sessionId,
          url: result.url,
        },
      };
    } else if (checkoutInfo.provider === PaymentProvider.PAYSTACK) {
      const result = await this.checkoutService.createPaystackCheckoutSession({
        studentId,
        examTypeId: dto.examTypeId,
        planId: dto.planId,
        currency: checkoutInfo.currency,
        successUrl,
        cancelUrl,
        customerEmail: req.user.email,
      });

      return {
        success: true,
        message: 'Paystack checkout session created',
        data: {
          provider: 'paystack',
          authorizationUrl: result.authorizationUrl,
          reference: result.reference,
        },
      };
    }

    throw new BadRequestException('Unsupported payment provider');
  }

  /**
   * Verify checkout session after payment redirect
   * GET /subscriptions/checkout/verify?session_id=xxx (Stripe)
   * GET /subscriptions/checkout/verify?reference=xxx (Paystack)
   */
  @Public()
  @Get('checkout/verify')
  async verifyCheckout(
    @Query('session_id') sessionId?: string,
    @Query('reference') reference?: string,
  ) {
    if (sessionId) {
      const result = await this.checkoutService.verifyStripeSession(sessionId);
      return {
        success: result.success,
        message: result.success
          ? 'Payment verified successfully'
          : 'Payment verification failed',
        data: { subscriptionId: result.subscriptionId },
      };
    }

    if (reference) {
      const result =
        await this.checkoutService.verifyPaystackTransaction(reference);
      return {
        success: result.success,
        message: result.success
          ? 'Payment verified successfully'
          : 'Payment verification failed',
        data: { subscriptionId: result.subscriptionId },
      };
    }

    throw new BadRequestException('Either session_id or reference is required');
  }

  /**
   * Get the student's active subscription for an exam type
   * GET /subscriptions/my-subscription?examTypeId=xxx
   */
  @UseGuards(JwtAuthGuard)
  @Get('my-subscription')
  async getMySubscription(
    @Query('examTypeId') examTypeId: string,
    @Req() req: Request & { user: User },
  ) {
    const studentId = req.user.studentProfile?.id;
    if (!studentId) {
      throw new BadRequestException('Student profile not found');
    }

    if (!examTypeId) {
      throw new BadRequestException('examTypeId is required');
    }

    const subscription =
      await this.subscriptionsService.findCurrentSubscription(
        studentId,
        examTypeId,
      );

    // Fetch next_payment_date from Paystack for recurring active subs
    let nextPaymentDate: string | null = null;
    if (
      subscription?.status === SubscriptionStatus.ACTIVE &&
      subscription.autoRenew &&
      subscription.providerSubscriptionId &&
      subscription.paymentProvider === PaymentProvider.PAYSTACK
    ) {
      const paystackSub =
        await this.subscriptionsService.fetchPaystackSubscription(
          subscription.providerSubscriptionId,
        );
      nextPaymentDate = paystackSub?.next_payment_date ?? null;
    }

    // Upcoming (SCHEDULED) sub: only shown when current sub is CANCELLED
    let upcomingSubscription: {
      id: string;
      planId: string;
      amountPaid: number;
      currency: string;
      scheduledStartDate: Date | null;
      plan: { id: string; name: string; durationDays: number } | null;
    } | null = null;
    if (subscription?.status === SubscriptionStatus.CANCELLED) {
      const scheduled =
        await this.subscriptionsService.findScheduledSubscription(
          studentId,
          examTypeId,
        );
      if (scheduled) {
        upcomingSubscription = {
          id: scheduled.id,
          planId: scheduled.planId,
          amountPaid: scheduled.amountPaid,
          currency: scheduled.currency,
          scheduledStartDate: scheduled.startDate,
          plan: scheduled.plan
            ? {
                id: scheduled.plan.id,
                name: scheduled.plan.name,
                durationDays: scheduled.plan.durationDays,
              }
            : null,
        };
      }
    }

    return {
      success: true,
      message: subscription ? 'Subscription found' : 'No active subscription',
      data: subscription
        ? {
            id: subscription.id,
            planId: subscription.planId,
            status: subscription.status,
            amountPaid: subscription.amountPaid,
            currency: subscription.currency,
            paymentProvider: subscription.paymentProvider,
            startDate: subscription.startDate,
            endDate: subscription.endDate,
            autoRenew: subscription.autoRenew,
            nextPaymentDate,
            providerSubscriptionId: subscription.providerSubscriptionId,
            cancelledAt: subscription.cancelledAt,
            upcomingSubscription,
            plan: subscription.plan
              ? {
                  id: subscription.plan.id,
                  name: subscription.plan.name,
                  durationDays: subscription.plan.durationDays,
                  description: subscription.plan.description,
                }
              : null,
          }
        : null,
    };
  }

  /**
   * Get card info for the student's active subscription (Paystack only)
   * GET /subscriptions/my-subscription/card-info?examTypeId=xxx
   */
  @UseGuards(JwtAuthGuard)
  @Get('my-subscription/card-info')
  async getMySubscriptionCardInfo(
    @Query('examTypeId') examTypeId: string,
    @Req() req: Request & { user: User },
  ) {
    const studentId = req.user.studentProfile?.id;
    if (!studentId) {
      throw new BadRequestException('Student profile not found');
    }

    const subscription =
      await this.subscriptionsService.findCurrentSubscription(
        studentId,
        examTypeId,
      );

    if (!subscription?.providerSubscriptionId) {
      return { success: true, message: 'No card info available', data: null };
    }

    const cardInfo = await this.subscriptionsService.fetchPaystackSubscription(
      subscription.providerSubscriptionId,
    );

    return {
      success: true,
      message: cardInfo ? 'Card info retrieved' : 'No card info available',
      data: cardInfo,
    };
  }

  /**
   * Get Paystack manage link for updating card
   * GET /subscriptions/my-subscription/manage-link?examTypeId=xxx
   */
  @UseGuards(JwtAuthGuard)
  @Get('my-subscription/manage-link')
  async getMySubscriptionManageLink(
    @Query('examTypeId') examTypeId: string,
    @Req() req: Request & { user: User },
  ) {
    const studentId = req.user.studentProfile?.id;
    if (!studentId) {
      throw new BadRequestException('Student profile not found');
    }

    const subscription =
      await this.subscriptionsService.findCurrentSubscription(
        studentId,
        examTypeId,
      );

    if (!subscription?.providerSubscriptionId) {
      return { success: true, message: 'No manage link available', data: null };
    }

    const link = await this.subscriptionsService.getPaystackManageLink(
      subscription.providerSubscriptionId,
    );

    return {
      success: true,
      message: link
        ? 'Manage link generated'
        : 'Unable to generate manage link',
      data: link ? { link } : null,
    };
  }

  /**
   * Cancel the student's active subscription
   * POST /subscriptions/my-subscription/cancel?examTypeId=xxx
   */
  @UseGuards(JwtAuthGuard)
  @Post('my-subscription/cancel')
  async cancelMySubscription(
    @Query('examTypeId') examTypeId: string,
    @Req() req: Request & { user: User },
  ) {
    const studentId = req.user.studentProfile?.id;
    if (!studentId) {
      throw new BadRequestException('Student profile not found');
    }

    const subscription =
      await this.subscriptionsService.findCurrentSubscription(
        studentId,
        examTypeId,
      );

    if (!subscription) {
      throw new BadRequestException('No active subscription to cancel');
    }

    if (subscription.status === SubscriptionStatus.CANCELLED) {
      throw new BadRequestException('Subscription is already cancelled');
    }

    // Cancel at payment provider (stop recurring charges)
    if (subscription.providerSubscriptionId) {
      if (subscription.paymentProvider === PaymentProvider.PAYSTACK) {
        await this.subscriptionsService.cancelPaystackSubscription(
          subscription.providerSubscriptionId,
        );
      }
    }

    // Cancel the subscription — revokes access immediately
    await this.subscriptionsService.deactivateSubscription(
      subscription.id,
      'cancelled',
    );

    return {
      success: true,
      message: 'Subscription cancelled successfully',
    };
  }

  /**
   * Reactivate a cancelled subscription by creating a new one with the same plan.
   * Paystack doesn't support re-enabling cancelled subs, so we create a fresh
   * subscription on the same card — same flow as upgrade but with the same plan.
   * POST /subscriptions/my-subscription/reactivate?examTypeId=xxx
   */
  @UseGuards(JwtAuthGuard)
  @Post('my-subscription/reactivate')
  async reactivateMySubscription(
    @Query('examTypeId') examTypeId: string,
    @Req() req: Request & { user: User },
  ) {
    const studentId = req.user.studentProfile?.id;
    if (!studentId) {
      throw new BadRequestException('Student profile not found');
    }

    const subscription =
      await this.subscriptionsService.findCurrentSubscription(
        studentId,
        examTypeId,
      );

    if (!subscription || subscription.status !== SubscriptionStatus.CANCELLED) {
      throw new BadRequestException('No cancelled subscription to reactivate');
    }

    // Block if there's already a scheduled subscription waiting
    const scheduled = await this.subscriptionsService.findScheduledSubscription(
      studentId,
      examTypeId,
    );
    if (scheduled) {
      throw new BadRequestException(
        'You already have an upcoming subscription. Please wait for it to activate.',
      );
    }

    if (subscription.paymentProvider !== PaymentProvider.PAYSTACK) {
      throw new BadRequestException(
        'Reactivation is currently only supported for Paystack subscriptions',
      );
    }

    if (
      !subscription.providerSubscriptionId ||
      !subscription.providerCustomerId
    ) {
      throw new BadRequestException(
        'Missing provider subscription details. Please contact support.',
      );
    }

    // Find the same plan's price
    const planPrice = await this.subscriptionsService.findPlanPrice(
      subscription.planId,
      subscription.currency,
    );

    if (!planPrice || !planPrice.paystackPlanCode) {
      throw new BadRequestException('Plan not available for your currency');
    }

    // Get authorization code from current (cancelled) Paystack subscription
    const authCode =
      await this.subscriptionsService.getPaystackAuthorizationCode(
        subscription.providerSubscriptionId,
      );

    if (!authCode) {
      throw new BadRequestException(
        'Could not retrieve payment authorization. Please contact support.',
      );
    }

    // Create new Paystack subscription with same plan (old one is already disabled)
    const newSub = await this.subscriptionsService.createPaystackSubscription({
      customerCode: subscription.providerCustomerId,
      planCode: planPrice.paystackPlanCode,
      authorizationCode: authCode,
    });

    if (!newSub) {
      throw new BadRequestException(
        'Failed to create subscription at payment provider.',
      );
    }

    // Create new subscription record in DB (PENDING — activated by webhook)
    const newSubscription = await this.subscriptionsService.createSubscription({
      studentId,
      examTypeId,
      planId: subscription.planId,
      planPriceId: planPrice.id,
      provider: PaymentProvider.PAYSTACK,
      currency: subscription.currency,
      amount: planPrice.amount,
      providerSubscriptionId: newSub.subscriptionCode,
      providerCustomerId: subscription.providerCustomerId,
    });

    return {
      success: true,
      message: 'Subscription reactivated successfully',
      data: {
        newSubscriptionId: newSubscription.id,
        providerSubscriptionId: newSub.subscriptionCode,
      },
    };
  }

  /**
   * Upgrade/downgrade the student's active subscription to a different plan
   * POST /subscriptions/my-subscription/upgrade
   * Paystack only: cancels old sub at provider, creates new sub on same card
   */
  @UseGuards(JwtAuthGuard)
  @Post('my-subscription/upgrade')
  async upgradeMySubscription(
    @Body() dto: UpgradeSubscriptionDto,
    @Req() req: Request & { user: User },
  ) {
    const studentId = req.user.studentProfile?.id;
    if (!studentId) {
      throw new BadRequestException('Student profile not found');
    }

    const subscription =
      await this.subscriptionsService.findCurrentSubscription(
        studentId,
        dto.examTypeId,
      );

    if (!subscription || subscription.status !== SubscriptionStatus.ACTIVE) {
      throw new BadRequestException('No active subscription to upgrade');
    }

    if (subscription.planId === dto.targetPlanId) {
      throw new BadRequestException('Already on this plan');
    }

    // Block if there's already a scheduled subscription waiting
    const scheduled = await this.subscriptionsService.findScheduledSubscription(
      studentId,
      dto.examTypeId,
    );
    if (scheduled) {
      throw new BadRequestException(
        'You already have an upcoming subscription. Please wait for it to activate.',
      );
    }

    if (subscription.paymentProvider !== PaymentProvider.PAYSTACK) {
      throw new BadRequestException(
        'Upgrade is currently only supported for Paystack subscriptions',
      );
    }

    if (
      !subscription.providerSubscriptionId ||
      !subscription.providerCustomerId
    ) {
      throw new BadRequestException(
        'Missing provider subscription details. Please contact support.',
      );
    }

    // Find the target plan's price matching the current subscription currency
    const targetPrice = await this.subscriptionsService.findPlanPrice(
      dto.targetPlanId,
      subscription.currency,
    );

    if (!targetPrice || !targetPrice.paystackPlanCode) {
      throw new BadRequestException(
        'Target plan not available for your currency',
      );
    }

    // Get authorization code from current Paystack subscription
    const authCode =
      await this.subscriptionsService.getPaystackAuthorizationCode(
        subscription.providerSubscriptionId,
      );

    if (!authCode) {
      throw new BadRequestException(
        'Could not retrieve payment authorization. Please contact support.',
      );
    }

    // 1. Cancel old subscription at Paystack FIRST
    //    (must happen before creating new one — Paystack rejects duplicates)
    await this.subscriptionsService.cancelPaystackSubscription(
      subscription.providerSubscriptionId,
    );

    // 2. Cancel old subscription in DB (revokes access — new sub activates on webhook)
    await this.subscriptionsService.deactivateSubscription(
      subscription.id,
      'cancelled',
    );

    // 3. Create new subscription at Paystack (now that old one is disabled)
    const newSub = await this.subscriptionsService.createPaystackSubscription({
      customerCode: subscription.providerCustomerId,
      planCode: targetPrice.paystackPlanCode,
      authorizationCode: authCode,
    });

    if (!newSub) {
      throw new BadRequestException(
        'Failed to create new subscription at payment provider. ' +
          'The old subscription has been cancelled. Please subscribe to the new plan manually.',
      );
    }

    // 4. Create new subscription record in DB (PENDING — activated by webhook)
    const newSubscription = await this.subscriptionsService.createSubscription({
      studentId,
      examTypeId: dto.examTypeId,
      planId: dto.targetPlanId,
      planPriceId: targetPrice.id,
      provider: PaymentProvider.PAYSTACK,
      currency: subscription.currency,
      amount: targetPrice.amount,
      providerSubscriptionId: newSub.subscriptionCode,
      providerCustomerId: subscription.providerCustomerId,
    });

    return {
      success: true,
      message: 'Subscription upgraded successfully',
      data: {
        newSubscriptionId: newSubscription.id,
        providerSubscriptionId: newSub.subscriptionCode,
      },
    };
  }

  // === ADMIN ROUTES ===

  /**
   * Force reseed all subscription plans and prices
   * POST /subscriptions/admin/reseed
   * Admin only - clears existing plans/prices and recreates from seed data
   */
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(UserType.ADMIN)
  @Post('admin/reseed')
  async reseedPlans() {
    const result: { plansCreated: number; pricesCreated: number } =
      await this.subscriptionsService.forceReseedPlans();
    return {
      success: true,
      message: `Reseeded ${result.plansCreated} plans with ${result.pricesCreated} prices`,
      data: result,
    };
  }
}
