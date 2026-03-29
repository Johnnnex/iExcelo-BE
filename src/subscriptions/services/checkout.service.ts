import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Stripe from 'stripe';
import { SubscriptionPlan, PlanPrice } from '../entities';
import { SubscriptionsService } from '../subscriptions.service';
import { TransactionsService } from './transactions.service';
import {
  PaymentProvider,
  PaymentStatus,
  Currency,
  TransactionType,
} from '../../../types';

@Injectable()
export class CheckoutService {
  private stripe: Stripe | null = null;

  constructor(
    private configService: ConfigService,
    private subscriptionsService: SubscriptionsService,
    private transactionsService: TransactionsService,
    @InjectRepository(SubscriptionPlan)
    private planRepo: Repository<SubscriptionPlan>,
    @InjectRepository(PlanPrice)
    private planPriceRepo: Repository<PlanPrice>,
  ) {
    // Initialize Stripe if secret key is available
    const stripeSecretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (stripeSecretKey) {
      this.stripe = new Stripe(stripeSecretKey);
    }
  }

  /**
   * Create a Stripe checkout session for subscription
   */
  async createStripeCheckoutSession(data: {
    studentId: string;
    examTypeId: string;
    planId: string;
    currency: Currency;
    successUrl: string;
    cancelUrl: string;
    customerEmail?: string;
  }): Promise<{ sessionId: string; url: string }> {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured');
    }

    // Get plan and price
    const plan = await this.planRepo.findOne({
      where: { id: data.planId, isActive: true },
    });

    if (!plan) {
      throw new BadRequestException('Plan not found');
    }

    const price = await this.planPriceRepo.findOne({
      where: {
        planId: data.planId,
        currency: data.currency,
        isActive: true,
      },
    });

    if (!price) {
      throw new BadRequestException(`Price not available for ${data.currency}`);
    }

    // Create pending subscription in our database first
    const subscription = await this.subscriptionsService.createSubscription({
      studentId: data.studentId,
      examTypeId: data.examTypeId,
      planId: data.planId,
      planPriceId: price.id, // Link to the exact price being purchased
      provider: PaymentProvider.STRIPE,
      currency: data.currency,
      amount: price.amount,
    });

    // Create Stripe checkout session
    // If we have a pre-configured stripePriceId, use it; otherwise create dynamic price
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      payment_method_types: ['card', 'link'],
      line_items: [
        {
          price_data: {
            currency: data.currency.toLowerCase(),
            product_data: {
              name: `iExcelo - ${plan.name}`,
              description:
                plan.description || `${plan.durationDays} days access`,
            },
            unit_amount: Math.round(price.amount * 100), // Stripe uses cents
            recurring: {
              interval: 'day',
              interval_count: plan.durationDays,
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${data.successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: data.cancelUrl,
      metadata: {
        subscriptionId: subscription.id,
        studentId: data.studentId,
        examTypeId: data.examTypeId,
        planId: data.planId,
      },
      subscription_data: {
        metadata: {
          subscriptionId: subscription.id,
          studentId: data.studentId,
          examTypeId: data.examTypeId,
          planId: data.planId,
        },
      },
    };

    // Add customer email if provided
    if (data.customerEmail) {
      sessionParams.customer_email = data.customerEmail;
    }

    const session = await this.stripe.checkout.sessions.create(sessionParams);

    // Update subscription with Stripe session ID
    subscription.providerSubscriptionId = session.id;
    await this.subscriptionsService['subscriptionRepo'].save(subscription);

    // Create PENDING transaction record for audit trail
    // studentExamTypeId left undefined — it may not exist yet for first-time subscribers
    await this.transactionsService.create({
      studentId: data.studentId,
      subscriptionId: subscription.id,
      type: TransactionType.SUBSCRIPTION_PURCHASE,
      amount: price.amount,
      currency: data.currency,
      provider: PaymentProvider.STRIPE,
      providerTransactionId: session.id,
    });

    return {
      sessionId: session.id,
      url: session.url!,
    };
  }

  /**
   * Create a Paystack checkout session for subscription
   *
   * Paystack subscriptions work differently from Stripe:
   * - If we have a paystackPlanCode, we initialize with `plan` parameter
   *   which tells Paystack to create a subscription after payment
   * - The plan must be created in Paystack dashboard or via API first
   */
  async createPaystackCheckoutSession(data: {
    studentId: string;
    examTypeId: string;
    planId: string;
    currency: Currency;
    successUrl: string;
    cancelUrl: string;
    customerEmail: string;
  }): Promise<{ authorizationUrl: string; reference: string }> {
    const paystackSecretKey = this.configService.get<string>(
      'PAYSTACK_SECRET_KEY',
    );

    if (!paystackSecretKey) {
      throw new BadRequestException('Paystack is not configured');
    }

    // Get plan and price
    const plan = await this.planRepo.findOne({
      where: { id: data.planId, isActive: true },
    });

    if (!plan) {
      throw new BadRequestException('Plan not found');
    }

    const price = await this.planPriceRepo.findOne({
      where: {
        planId: data.planId,
        currency: data.currency,
        isActive: true,
      },
    });

    if (!price) {
      throw new BadRequestException(`Price not available for ${data.currency}`);
    }

    // Check if we have a Paystack plan code for subscription billing
    if (!price.paystackPlanCode) {
      throw new BadRequestException(
        'Paystack plan not configured for this price. Please set up the plan in Paystack dashboard.',
      );
    }

    // Create pending subscription in our database first
    const subscription = await this.subscriptionsService.createSubscription({
      studentId: data.studentId,
      examTypeId: data.examTypeId,
      planId: data.planId,
      planPriceId: price.id,
      provider: PaymentProvider.PAYSTACK,
      currency: data.currency,
      amount: price.amount,
    });

    // Initialize Paystack transaction with plan parameter for subscription
    // When you include `plan`, Paystack will:
    // 1. Charge the customer the plan amount (ignores amount field)
    // 2. Create a subscription for recurring billing
    // 3. Send webhooks: charge.success, then subscription.create
    // We do NOT send our own reference — Paystack auto-generates one.
    // We do NOT embed reference in callback_url — Paystack appends
    // ?trxref=REF&reference=REF to the callback_url after payment.
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
          amount: Math.round(price.amount * 100), // Paystack uses kobo (overridden by plan amount)
          currency: data.currency,
          plan: price.paystackPlanCode,
          callback_url: data.successUrl,
          metadata: {
            subscriptionId: subscription.id,
            studentId: data.studentId,
            examTypeId: data.examTypeId,
            planId: data.planId,
            custom_fields: [
              {
                display_name: 'Plan',
                variable_name: 'plan_name',
                value: plan.name,
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
      throw new BadRequestException(
        result.message || 'Failed to initialize Paystack transaction',
      );
    }

    // providerSubscriptionId is left null — it will be set to the actual
    // subscription_code (SUB_xxx) by the subscription.create webhook.

    // Create PENDING transaction record for audit trail
    // studentExamTypeId left undefined — it may not exist yet for first-time subscribers
    await this.transactionsService.create({
      studentId: data.studentId,
      subscriptionId: subscription.id,
      type: TransactionType.SUBSCRIPTION_PURCHASE,
      amount: price.amount,
      currency: data.currency,
      provider: PaymentProvider.PAYSTACK,
      providerTransactionId: result.data.reference,
    });

    return {
      authorizationUrl: result.data.authorization_url,
      reference: result.data.reference,
    };
  }

  /**
   * Verify Stripe checkout session and activate subscription
   */
  async verifyStripeSession(sessionId: string): Promise<{
    success: boolean;
    subscriptionId?: string;
  }> {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured');
    }

    const session = await this.stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    });

    if (session.payment_status !== 'paid') {
      return { success: false };
    }

    const subscriptionId = session.metadata?.subscriptionId;
    if (subscriptionId) {
      // Update subscription with Stripe subscription ID
      const subscription = await this.subscriptionsService[
        'subscriptionRepo'
      ].findOne({
        where: { id: subscriptionId },
      });

      if (subscription) {
        const stripeSubscription = session.subscription as Stripe.Subscription;
        subscription.providerSubscriptionId = stripeSubscription.id;
        subscription.providerCustomerId = session.customer as string;
        await this.subscriptionsService['subscriptionRepo'].save(subscription);

        // Activate the subscription
        await this.subscriptionsService.activateSubscription(subscriptionId);
      }
    }

    return { success: true, subscriptionId };
  }

  /**
   * Verify Paystack transaction and activate subscription
   *
   * When a transaction includes a plan, Paystack automatically creates
   * a subscription. We verify the transaction and activate our internal
   * subscription record.
   */
  async verifyPaystackTransaction(reference: string): Promise<{
    success: boolean;
    subscriptionId?: string;
  }> {
    const paystackSecretKey = this.configService.get<string>(
      'PAYSTACK_SECRET_KEY',
    );

    if (!paystackSecretKey) {
      throw new BadRequestException('Paystack is not configured');
    }

    console.log(`[Paystack] Verifying transaction: ${reference}`);

    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${paystackSecretKey}`,
        },
      },
    );

    const result = (await response.json()) as {
      status: boolean;
      message?: string;
      data?: {
        status: string;
        reference: string;
        amount: number;
        currency: string;
        customer?: {
          id: number;
          customer_code: string;
          email: string;
        };
        authorization?: {
          authorization_code: string;
          card_type: string;
          last4: string;
          reusable: boolean;
        };
        plan?: string; // Plan code if this was a subscription payment
        plan_object?: {
          id: number;
          name: string;
          plan_code: string;
          interval: string;
          amount: number;
        };
        metadata?: {
          subscriptionId?: string;
          studentId?: string;
          examTypeId?: string;
          planId?: string;
        };
      };
    };

    console.log(
      '[Paystack] Verification response:',
      JSON.stringify(result, null, 2),
    );

    if (!result.status) {
      console.log(`[Paystack] Verification failed: ${result.message}`);
      return { success: false };
    }

    if (result.data?.status !== 'success') {
      console.log(
        `[Paystack] Transaction not successful: ${result.data?.status}`,
      );
      return { success: false };
    }

    const subscriptionId = result.data.metadata?.subscriptionId;
    if (subscriptionId) {
      // Store customer_code on the subscription record
      if (result.data.customer?.customer_code) {
        await this.subscriptionsService.updateProviderInfo(subscriptionId, {
          providerCustomerId: result.data.customer.customer_code,
        });
      }

      // Update Transaction to SUCCEEDED (idempotent — safe if webhook already did it)
      const transaction =
        await this.transactionsService.findByProviderTransactionId(reference);
      if (transaction) {
        await this.transactionsService.updateStatus(
          transaction.id,
          PaymentStatus.SUCCEEDED,
        );
        if (result.data.customer?.customer_code) {
          await this.transactionsService.updateCustomerId(
            transaction.id,
            result.data.customer.customer_code,
          );
        }
      }

      // Activate the subscription (idempotent — safe if webhook already did it)
      await this.subscriptionsService.activateSubscription(subscriptionId);
      console.log(
        `[Paystack] Subscription verified and activated: ${subscriptionId}`,
      );
    }

    return { success: true, subscriptionId };
  }
}
