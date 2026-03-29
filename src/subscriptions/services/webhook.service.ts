/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Injectable } from '@nestjs/common';
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
} from '../../../types';

@Injectable()
export class WebhookService {
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
      // No transaction exists — create one from webhook data (idempotent fallback)
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
        // Mark immediately as succeeded
        await this.transactionsService.updateStatus(
          transaction.id,
          PaymentStatus.SUCCEEDED,
        );
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
      if (existingSub?.status === 'active' && existingSub.startDate) {
        await this.subscriptionsService.renewSubscription(
          subscriptionId,
          paymentData?.amount
            ? paymentData.amount / 100
            : existingSub.amountPaid,
        );
      } else {
        await this.subscriptionsService.activateSubscription(subscriptionId);
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
    },
  ): Promise<void> {
    // Strategy 1: find by customer_code + plan (if charge.success already stored it)
    let subscription =
      await this.subscriptionsService.findRecentByProviderCustomer(
        provider,
        data.customerCode,
        data.planCode,
      );

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
      // Store the Paystack subscription_code — needed for disable/not_renew events
      await this.subscriptionsService.updateProviderInfo(subscription.id, {
        providerSubscriptionId: data.subscriptionCode,
        providerCustomerId: data.customerCode,
      });

      console.log(
        `[Webhook] Stored subscription_code ${data.subscriptionCode} on subscription ${subscription.id}`,
      );
    } else {
      console.warn(
        `[Webhook] subscription.create: Could not find matching subscription for customer ${data.customerCode}, plan ${data.planCode}`,
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
        studentExamTypeId: subscription.studentExamTypeId || '',
        subscriptionId: subscription.id,
        type: TransactionType.SUBSCRIPTION_RENEWAL,
        amount: amountInMajor,
        currency: (data.currency?.toUpperCase() ||
          subscription.currency) as Currency,
        provider,
        providerTransactionId: data.reference,
        providerCustomerId: subscription.providerCustomerId,
      });

      console.log(
        `[Webhook] Subscription renewed: ${subscription.id} (${data.subscriptionCode})`,
      );
    } else {
      console.warn(
        `[Webhook] invoice.update: Could not find subscription for code ${data.subscriptionCode}`,
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
      console.log(
        `[Webhook] Subscription payment failed: ${subscription.id} - ${data.description}`,
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
      subscription.status !== 'cancelled' &&
      subscription.status !== 'expired'
    ) {
      await this.subscriptionsService.deactivateSubscription(
        subscription.id,
        'cancelled',
      );
      console.log(
        `[Webhook] Subscription ${subscription.id} cancelled via provider webhook`,
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
