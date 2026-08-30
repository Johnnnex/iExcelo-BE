import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { WebhookEvent } from '../entities';
import { SubscriptionsService } from '../subscriptions.service';
import { TransactionsService } from './transactions.service';
import { LoggerService } from '../../logger/logger.service';
import {
  PaymentProvider,
  PaymentStatus,
  WebhookEventType,
  LogActionTypes,
  TransactionType,
  Currency,
  SubscriptionStatus,
} from '../../../types';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    @InjectRepository(WebhookEvent)
    private webhookEventRepo: Repository<WebhookEvent>,
    private subscriptionsService: SubscriptionsService,
    private transactionsService: TransactionsService,
    private loggerService: LoggerService,
    private configService: ConfigService,
  ) {}

  /**
   * Check if webhook event already exists (idempotency).
   * Returns true if the event row EXISTS at all — prevents duplicate INSERT
   * race conditions when Paystack retries quickly.
   */
  async isEventProcessed(
    provider: PaymentProvider,
    eventId: string,
  ): Promise<boolean> {
    const event = await this.webhookEventRepo.findOne({
      where: { provider, providerEventId: eventId },
    });
    return !!event;
  }

  /**
   * Find an existing event that failed processing (for retry support).
   * Returns the event if it exists AND is not yet successfully processed.
   */
  async findUnprocessedEvent(
    provider: PaymentProvider,
    eventId: string,
  ): Promise<WebhookEvent | null> {
    return this.webhookEventRepo.findOne({
      where: { provider, providerEventId: eventId, isProcessed: false },
    });
  }

  /**
   * Record webhook event for idempotency tracking
   */
  async recordEvent(data: {
    provider: PaymentProvider;
    providerEventId: string;
    eventType: WebhookEventType;
    payload: Record<string, any>;
  }): Promise<WebhookEvent> {
    const event = this.webhookEventRepo.create({
      ...data,
      isProcessed: false,
    });
    return this.webhookEventRepo.save(event);
  }

  /**
   * Mark event as processed
   */
  async markEventProcessed(eventId: string, error?: string): Promise<void> {
    const event = await this.webhookEventRepo.findOne({
      where: { id: eventId },
    });

    if (event) {
      event.isProcessed = !error;
      event.processedAt = new Date();
      event.processingError = error || null;
      event.retryCount += 1;
      await this.webhookEventRepo.save(event);
    }
  }

  /**
   * Verify Stripe webhook signature
   */
  verifyStripeSignature(payload: Buffer, signature: string): any {
    const secret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!secret) {
      throw new Error('Stripe webhook secret not configured');
    }

    // Stripe signature verification
    const elements = signature.split(',');
    const signatureMap: Record<string, string> = {};

    for (const element of elements) {
      const [key, value] = element.split('=');
      signatureMap[key] = value;
    }

    const timestamp = signatureMap['t'];
    const expectedSignature = signatureMap['v1'];

    const signedPayload = `${timestamp}.${payload.toString()}`;
    const computedSignature = crypto
      .createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');

    if (computedSignature !== expectedSignature) {
      throw new Error('Invalid Stripe signature');
    }

    return JSON.parse(payload.toString());
  }

  /**
   * Verify Paystack webhook signature
   */
  verifyPaystackSignature(payload: string, signature: string): boolean {
    const secret = this.configService.get<string>('PAYSTACK_SECRET_KEY');
    if (!secret) {
      throw new Error('Paystack secret key not configured');
    }

    const hash = crypto
      .createHmac('sha512', secret)
      .update(payload)
      .digest('hex');

    return hash === signature;
  }

  /**
   * Process payment succeeded event (initial charge)
   *
   * Creates or updates a Transaction record (idempotent) and activates
   * the linked subscription.  Also stores provider customer info so
   * subscription.create can match later.
   */
  async handlePaymentSucceeded(
    provider: PaymentProvider,
    providerTransactionId: string,
    metadata: {
      subscriptionId?: string;
      studentId?: string;
      examTypeId?: string;
    },
    customerInfo?: { customerCode?: string; email?: string },
    paymentData?: { amount?: number; currency?: string },
    cardInfo?: {
      brand?: string | null;
      last4?: string | null;
      expMonth?: string | null;
      expYear?: string | null;
      bank?: string | null;
      channel?: string | null;
    },
  ): Promise<void> {
    // Try to find existing transaction (created at checkout)
    let transaction =
      await this.transactionsService.findByProviderTransactionId(
        providerTransactionId,
      );

    const subscriptionId =
      transaction?.subscriptionId || metadata.subscriptionId;

    if (transaction) {
      // Update existing transaction to SUCCEEDED
      await this.transactionsService.updateStatus(
        transaction.id,
        PaymentStatus.SUCCEEDED,
      );
      // Store customer code on transaction too
      if (customerInfo?.customerCode) {
        await this.transactionsService.updateCustomerId(
          transaction.id,
          customerInfo.customerCode,
        );
      }
    } else if (subscriptionId) {
      // Check for an existing PENDING transaction for this subscription first.
      // This happens when the checkout session ID (cs_xxx) was stored at checkout
      // but the webhook fires with a different provider ID (e.g. Stripe invoice
      // in_xxx), so findByProviderTransactionId above returned nothing.
      const pendingForSub =
        await this.transactionsService.findPendingBySubscriptionId(
          subscriptionId,
        );

      if (pendingForSub) {
        await this.transactionsService.updateStatus(
          pendingForSub.id,
          PaymentStatus.SUCCEEDED,
        );
        // Stamp the real provider transaction ID (e.g. Stripe invoice in_xxx) so
        // subsequent calls to handlePaymentSucceeded with the same ID find this
        // record directly and don't fall through to create a duplicate.
        if (
          providerTransactionId &&
          pendingForSub.providerTransactionId !== providerTransactionId
        ) {
          await this.transactionsService.updateProviderTransactionId(
            pendingForSub.id,
            providerTransactionId,
          );
        }
        if (customerInfo?.customerCode) {
          await this.transactionsService.updateCustomerId(
            pendingForSub.id,
            customerInfo.customerCode,
          );
        }
        transaction = pendingForSub;
      } else {
        // True fallback — no transaction at all, create one from webhook data
        const subscription =
          await this.subscriptionsService.findSubscriptionById(subscriptionId);

        if (subscription) {
          transaction = await this.transactionsService.create({
            studentId: subscription.studentId,
            studentExamTypeId: subscription.studentExamTypeId || undefined,
            subscriptionId: subscription.id,
            type: TransactionType.SUBSCRIPTION_PURCHASE,
            amount: paymentData?.amount
              ? paymentData.amount / 100
              : subscription.amountPaid,
            currency: (paymentData?.currency?.toUpperCase() ||
              subscription.currency) as Currency,
            provider,
            providerTransactionId,
            providerCustomerId: customerInfo?.customerCode,
          });
          await this.transactionsService.updateStatus(
            transaction.id,
            PaymentStatus.SUCCEEDED,
          );
        }
      }
    }

    // Store customer info FIRST — subscription.create webhook fires nearly
    // simultaneously and needs providerCustomerId to match via Strategy 1.
    if (subscriptionId) {
      if (customerInfo?.customerCode) {
        await this.subscriptionsService.updateProviderInfo(subscriptionId, {
          providerCustomerId: customerInfo.customerCode,
        });
      }

      // If subscription is already ACTIVE (has startDate), this is a renewal — extend period.
      // Otherwise it's initial activation.
      const existingSub =
        await this.subscriptionsService.findSubscriptionById(subscriptionId);
      if (
        existingSub?.status === SubscriptionStatus.ACTIVE &&
        existingSub.startDate
      ) {
        await this.subscriptionsService.renewSubscription(
          subscriptionId,
          paymentData?.amount
            ? paymentData.amount / 100
            : existingSub.amountPaid,
        );
      } else {
        await this.subscriptionsService.activateSubscription(subscriptionId);
      }

      // Persist card info so billing history can show it without extra API calls
      if (cardInfo?.last4) {
        await this.subscriptionsService.updateCardInfo(subscriptionId, {
          cardBrand: cardInfo.brand || undefined,
          cardLast4: cardInfo.last4 || undefined,
          cardExpMonth: cardInfo.expMonth || undefined,
          cardExpYear: cardInfo.expYear || undefined,
          cardBank: cardInfo.bank || undefined,
          cardChannel: cardInfo.channel || undefined,
        });
      }
    }

    // Log success
    await this.loggerService.log({
      action: LogActionTypes.PAYMENT,
      description: 'Payment succeeded via webhook',
      metadata: { provider, providerTransactionId, ...metadata },
    });
  }

  /**
   * Process subscription.create event (Paystack sends this after initial charge)
   * Stores the Paystack subscription_code so we can match future events.
   *
   * Matching strategy (in priority order):
   * 1. Find by providerCustomerId + planCode (fastest — works if charge.success already stored it)
   * 2. Find by student email + planCode (always works — no race condition dependency)
   */
  async handleSubscriptionCreated(
    provider: PaymentProvider,
    data: {
      subscriptionCode: string;
      planCode: string;
      customerCode: string;
      customerEmail: string;
      /** Stripe: our DB subscription ID embedded in subscription_data.metadata */
      directSubscriptionId?: string;
    },
  ): Promise<void> {
    let subscription = data.directSubscriptionId
      ? await this.subscriptionsService.findSubscriptionById(
          data.directSubscriptionId,
        )
      : null;

    if (!subscription) {
      // Strategy 1: find by customer_code + plan (if charge.success already stored it)
      subscription =
        await this.subscriptionsService.findRecentByProviderCustomer(
          provider,
          data.customerCode,
          data.planCode,
        );
    }

    // Strategy 2: find by student email + plan (always works, joins through StudentProfile → User)
    if (!subscription && data.customerEmail) {
      subscription =
        await this.subscriptionsService.findSubscriptionByStudentEmail(
          provider,
          data.customerEmail,
          data.planCode,
        );
    }

    if (subscription) {
      await this.subscriptionsService.updateProviderInfo(subscription.id, {
        providerSubscriptionId: data.subscriptionCode,
        providerCustomerId: data.customerCode,
      });

      this.logger.log(
        `Stored subscription_code ${data.subscriptionCode} on subscription ${subscription.id}`,
      );
    } else {
      this.logger.warn(
        `subscription.create: no matching subscription for customer ${data.customerCode}, plan ${data.planCode}`,
      );
    }

    await this.loggerService.log({
      action: LogActionTypes.PAYMENT,
      description: 'Subscription created via webhook',
      metadata: {
        provider,
        subscriptionCode: data.subscriptionCode,
        planCode: data.planCode,
        customerCode: data.customerCode,
      },
    });
  }

  /**
   * Process invoice.update with status=success (subscription renewal)
   * Extends the subscription period, creates a RENEWAL transaction, and tracks revenue
   */
  async handleSubscriptionRenewed(
    provider: PaymentProvider,
    data: {
      subscriptionCode: string;
      amount: number;
      currency: string;
      reference?: string;
      cardInfo?: {
        brand?: string | null;
        last4?: string | null;
        expMonth?: string | null;
        expYear?: string | null;
        bank?: string | null;
        channel?: string | null;
      };
    },
  ): Promise<void> {
    const subscription =
      await this.subscriptionsService.findByProviderSubscriptionId(
        data.subscriptionCode,
      );

    if (subscription) {
      const amountInMajor = data.amount / 100; // Convert from kobo/cents

      await this.subscriptionsService.renewSubscription(
        subscription.id,
        amountInMajor,
      );

      // Create renewal transaction record
      await this.transactionsService.create({
        studentId: subscription.studentId,
        studentExamTypeId: subscription.studentExamTypeId || undefined,
        subscriptionId: subscription.id,
        type: TransactionType.SUBSCRIPTION_RENEWAL,
        amount: amountInMajor,
        currency: (data.currency?.toUpperCase() ||
          subscription.currency) as Currency,
        provider,
        providerTransactionId: data.reference,
        providerCustomerId: subscription.providerCustomerId,
      });

      // Update card info if a new authorization was provided on renewal
      if (data.cardInfo?.last4) {
        await this.subscriptionsService.updateCardInfo(subscription.id, {
          cardBrand: data.cardInfo.brand || undefined,
          cardLast4: data.cardInfo.last4 || undefined,
          cardExpMonth: data.cardInfo.expMonth || undefined,
          cardExpYear: data.cardInfo.expYear || undefined,
          cardBank: data.cardInfo.bank || undefined,
          cardChannel: data.cardInfo.channel || undefined,
        });
      }

      this.logger.log(
        `Subscription renewed: ${subscription.id} (${data.subscriptionCode})`,
      );
    } else {
      this.logger.warn(
        `invoice.update: no subscription for code ${data.subscriptionCode}`,
      );
    }

    await this.loggerService.log({
      action: LogActionTypes.PAYMENT,
      description: 'Subscription renewed via webhook',
      metadata: { provider, ...data },
    });
  }

  /**
   * Process invoice.payment_failed (recurring payment failed)
   * Suspends the subscription
   */
  async handleInvoicePaymentFailed(
    provider: PaymentProvider,
    data: {
      subscriptionCode: string;
      description?: string;
    },
  ): Promise<void> {
    const subscription =
      await this.subscriptionsService.findByProviderSubscriptionId(
        data.subscriptionCode,
      );

    if (subscription) {
      await this.subscriptionsService.deactivateSubscription(
        subscription.id,
        'payment_failed',
      );
      this.logger.warn(
        `Subscription payment failed: ${subscription.id} - ${data.description}`,
      );
    }

    await this.loggerService.log({
      action: LogActionTypes.ERROR,
      description: 'Subscription renewal payment failed',
      metadata: { provider, ...data },
    });
  }

  /**
   * Process payment failed event
   */
  async handlePaymentFailed(
    provider: PaymentProvider,
    providerTransactionId: string,
    failureReason: string,
    metadata?: { subscriptionId?: string },
  ): Promise<void> {
    // Update transaction status if exists
    const transaction =
      await this.transactionsService.findByProviderTransactionId(
        providerTransactionId,
      );

    if (transaction) {
      await this.transactionsService.updateStatus(
        transaction.id,
        PaymentStatus.FAILED,
        undefined,
        failureReason,
      );

      // Handle subscription failure
      if (transaction.subscriptionId) {
        await this.subscriptionsService.deactivateSubscription(
          transaction.subscriptionId,
          'payment_failed',
        );
      }
    } else if (metadata?.subscriptionId) {
      await this.subscriptionsService.deactivateSubscription(
        metadata.subscriptionId,
        'payment_failed',
      );
    }

    // Log failure
    await this.loggerService.log({
      action: LogActionTypes.ERROR,
      description: 'Payment failed via webhook',
      metadata: { provider, providerTransactionId, failureReason },
    });
  }

  /**
   * Process checkout.session.completed — retrieve card details from the newly
   * created Stripe subscription and persist them on our internal subscription.
   * This is the only reliable place to capture card info: the invoice payload
   * does not expand payment_intent/charge objects, so payment_method_details
   * is never available there without an extra API call.
   */
  async handleCheckoutCompleted(
    subscriptionId: string,
    stripeSubscriptionId: string,
  ): Promise<void> {
    await this.subscriptionsService.saveStripeCardInfoFromSubscription(
      subscriptionId,
      stripeSubscriptionId,
    );
    this.logger.log(
      `Card info saved for subscription ${subscriptionId} from checkout`,
    );
  }

  /**
   * Handle customer.updated when default_payment_method changes.
   * Updates card info on all ACTIVE Stripe subscriptions for the customer so
   * the billing page always shows the card that will actually be charged.
   */
  async handleCustomerDefaultPmUpdated(
    customerId: string,
    newPmId: string,
  ): Promise<void> {
    const count =
      await this.subscriptionsService.updateCardInfoFromStripePaymentMethod(
        customerId,
        newPmId,
      );
    this.logger.log(
      `Card info synced for ${count} active sub(s) on customer ${customerId}`,
    );
  }

  /**
   * Stripe webhook safety net for sponsor giveback sessions.
   * Fires when checkout.session.completed contains a givebackId instead of
   * a subscriptionId — meaning the sponsor's browser never called verifySponsorGiveback.
   */
  async handleGivebackCheckoutCompleted(givebackId: string): Promise<void> {
    const count =
      await this.subscriptionsService.activateGivebackSubscriptions(givebackId);
    this.logger.log(
      `Giveback ${givebackId}: ${count} subscription(s) activated via webhook fallback`,
    );
    await this.loggerService.log({
      action: LogActionTypes.PAYMENT,
      description: `Sponsor giveback activated via Stripe webhook fallback`,
      metadata: { givebackId, activatedCount: count },
    });
  }

  /**
   * Process customer.subscription.updated with cancel_at_period_end=false (re-enabled via portal).
   */
  async handleSubscriptionReactivated(
    provider: PaymentProvider,
    providerSubscriptionId: string,
  ): Promise<void> {
    const subscription =
      await this.subscriptionsService.findByProviderSubscriptionId(
        providerSubscriptionId,
      );

    if (subscription && subscription.status === SubscriptionStatus.CANCELLED) {
      await this.subscriptionsService.reactivateSubscription(subscription.id);
      this.logger.log(
        `Subscription ${subscription.id} re-enabled via provider webhook`,
      );
    }

    await this.loggerService.log({
      action: LogActionTypes.UPDATE,
      description: 'Subscription reactivation webhook received',
      metadata: { provider, providerSubscriptionId },
    });
  }

  /**
   * Process subscription cancelled/disabled/not_renew event.
   *
   * Cancelled = truly cancelled. Deactivate immediately regardless of endDate.
   * reconcileStudentSub() handles transitioning CANCELLED → EXPIRED on next dashboard load.
   */
  async handleSubscriptionCancelled(
    provider: PaymentProvider,
    providerSubscriptionId: string,
  ): Promise<void> {
    const subscription =
      await this.subscriptionsService.findByProviderSubscriptionId(
        providerSubscriptionId,
      );

    if (
      subscription &&
      subscription.status !== SubscriptionStatus.CANCELLED &&
      subscription.status !== SubscriptionStatus.EXPIRED
    ) {
      await this.subscriptionsService.deactivateSubscription(
        subscription.id,
        'cancelled',
      );
      this.logger.log(
        `Subscription ${subscription.id} cancelled via provider webhook`,
      );
    }

    await this.loggerService.log({
      action: LogActionTypes.UPDATE,
      description: 'Subscription cancellation webhook received',
      metadata: { provider, providerSubscriptionId },
    });
  }

  /**
   * Map Stripe event type to our enum
   */
  mapStripeEventType(type: string): WebhookEventType {
    const mapping: Record<string, WebhookEventType> = {
      'payment_intent.succeeded': WebhookEventType.PAYMENT_SUCCEEDED,
      'payment_intent.payment_failed': WebhookEventType.PAYMENT_FAILED,
      'invoice.paid': WebhookEventType.PAYMENT_SUCCEEDED,
      'invoice.payment_failed': WebhookEventType.PAYMENT_FAILED,
      'customer.subscription.created': WebhookEventType.SUBSCRIPTION_CREATED,
      'customer.subscription.updated': WebhookEventType.SUBSCRIPTION_UPDATED,
      'customer.subscription.deleted': WebhookEventType.SUBSCRIPTION_CANCELLED,
      'charge.refunded': WebhookEventType.REFUND_PROCESSED,
    };
    return mapping[type] || WebhookEventType.PAYMENT_SUCCEEDED;
  }

  /**
   * Map Paystack event type to our enum
   */
  mapPaystackEventType(event: string): WebhookEventType {
    const mapping: Record<string, WebhookEventType> = {
      'charge.success': WebhookEventType.PAYMENT_SUCCEEDED,
      'charge.failed': WebhookEventType.PAYMENT_FAILED,
      'subscription.create': WebhookEventType.SUBSCRIPTION_CREATED,
      'subscription.disable': WebhookEventType.SUBSCRIPTION_CANCELLED,
      'subscription.not_renew': WebhookEventType.SUBSCRIPTION_CANCELLED,
      'invoice.create': WebhookEventType.INVOICE_CREATED,
      'invoice.update': WebhookEventType.SUBSCRIPTION_RENEWED,
      'invoice.payment_failed': WebhookEventType.INVOICE_PAYMENT_FAILED,
      'refund.processed': WebhookEventType.REFUND_PROCESSED,
    };
    return mapping[event] || WebhookEventType.PAYMENT_SUCCEEDED;
  }
}
