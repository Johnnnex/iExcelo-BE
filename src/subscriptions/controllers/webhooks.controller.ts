/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Controller,
  Post,
  Headers,
  Body,
  Req,
  HttpCode,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import { WebhookService } from '../services';
import { Public } from '../../common/decorators';
import { PaymentProvider } from '../../../types';

@SkipThrottle()
@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(private readonly webhookService: WebhookService) {}

  /**
   * Stripe webhook endpoint
   * POST /webhooks/stripe
   */
  @Public()
  @Post('stripe')
  @HttpCode(200)
  async handleStripeWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() request: RawBodyRequest<Request>,
  ) {
    if (!signature) {
      throw new BadRequestException('Missing Stripe signature');
    }

    const payload = request.rawBody;
    if (!payload) {
      throw new BadRequestException('Missing request body');
    }

    // Verify signature and parse event
    let event: any;
    try {
      event = this.webhookService.verifyStripeSignature(payload, signature);
    } catch (err) {
      this.logger.error(
        `Invalid Stripe webhook signature: ${(err as { message: string })?.message}`,
      );
      throw new BadRequestException('Invalid Stripe signature');
    }

    // Check idempotency — also support retrying failed events
    let webhookEvent: any;
    if (
      await this.webhookService.isEventProcessed(
        PaymentProvider.STRIPE,
        event.id,
      )
    ) {
      const failedEvent = await this.webhookService.findUnprocessedEvent(
        PaymentProvider.STRIPE,
        event.id,
      );
      if (!failedEvent) {
        return { received: true, message: 'Event already processed' };
      }
      webhookEvent = failedEvent;
    } else {
      webhookEvent = await this.webhookService.recordEvent({
        provider: PaymentProvider.STRIPE,
        providerEventId: event.id,
        eventType: this.webhookService.mapStripeEventType(event.type),
        payload: event.data,
      });
    }

    try {
      // Process based on event type
      switch (event.type) {
        case 'payment_intent.succeeded':
        case 'invoice.paid':
          await this.webhookService.handlePaymentSucceeded(
            PaymentProvider.STRIPE,
            event.data.object.id,
            event.data.object.metadata || {},
          );
          break;

        case 'payment_intent.payment_failed':
        case 'invoice.payment_failed':
          await this.webhookService.handlePaymentFailed(
            PaymentProvider.STRIPE,
            event.data.object.id,
            event.data.object.last_payment_error?.message || 'Payment failed',
            event.data.object.metadata || {},
          );
          break;

        case 'customer.subscription.created':
          // Store the Stripe subscription ID on our DB subscription for future event matching
          await this.webhookService.handleSubscriptionCreated(
            PaymentProvider.STRIPE,
            {
              subscriptionCode: event.data.object.id,
              planCode: event.data.object.items?.data?.[0]?.price?.id || '',
              customerCode: event.data.object.customer,
              customerEmail: event.data.object.customer_email || '',
            },
          );
          break;

        case 'customer.subscription.deleted':
          await this.webhookService.handleSubscriptionCancelled(
            PaymentProvider.STRIPE,
            event.data.object.id,
          );
          break;

        default:
          this.logger.warn(`Unhandled Stripe event: ${event.type}`);
      }

      await this.webhookService.markEventProcessed(webhookEvent.id);
    } catch (error) {
      await this.webhookService.markEventProcessed(
        webhookEvent.id,
        (error as { message: string }).message,
      );
      throw error;
    }

    return { received: true };
  }

  /**
   * Paystack webhook endpoint
   * POST
   *
   */
  @Public()
  @Post('paystack')
  @HttpCode(200)
  async handlePaystackWebhook(
    @Headers('x-paystack-signature') signature: string,
    @Body() payload: any,
  ) {
    this.logger.debug(
      `Paystack webhook payload: ${JSON.stringify(payload, null, 2)}`,
    );
    if (!signature) {
      throw new BadRequestException('Missing Paystack signature');
    }

    // Verify signature
    if (
      !this.webhookService.verifyPaystackSignature(
        JSON.stringify(payload),
        signature,
      )
    ) {
      this.logger.error('Invalid Paystack webhook signature');
      throw new BadRequestException('Invalid Paystack signature');
    }

    // Extract event ID — prefix with event type to prevent clashes.
    // Without prefix, subscription.create and subscription.disable share
    // the same payload.data.id → idempotency check wrongly skips the second event.
    const rawId =
      payload.data?.reference ||
      payload.data?.subscription_code ||
      payload.data?.invoice_code ||
      payload.data?.id ||
      payload.id;
    const eventId = `${payload.event}:${rawId}`;

    // Check idempotency — also support retrying failed events
    let webhookEvent: any;
    if (
      await this.webhookService.isEventProcessed(
        PaymentProvider.PAYSTACK,
        eventId,
      )
    ) {
      const failedEvent = await this.webhookService.findUnprocessedEvent(
        PaymentProvider.PAYSTACK,
        eventId,
      );
      if (!failedEvent) {
        return { status: 'success', message: 'Event already processed' };
      }
      webhookEvent = failedEvent;
    } else {
      webhookEvent = await this.webhookService.recordEvent({
        provider: PaymentProvider.PAYSTACK,
        providerEventId: eventId,
        eventType: this.webhookService.mapPaystackEventType(payload.event),
        payload: payload.data,
      });
    }

    try {
      this.logger.debug(`Paystack event: ${payload.event}, ID: ${eventId}`);

      switch (payload.event) {
        case 'charge.success':
          await this.webhookService.handlePaymentSucceeded(
            PaymentProvider.PAYSTACK,
            payload.data.reference,
            payload.data.metadata || {},
            // Pass customer info so we can match subscription.create later
            payload.data.customer
              ? {
                  customerCode: payload.data.customer.customer_code,
                  email: payload.data.customer.email,
                }
              : undefined,
            // Pass payment data for transaction creation
            {
              amount: payload.data.amount,
              currency: payload.data.currency,
            },
          );
          break;

        case 'charge.failed':
          await this.webhookService.handlePaymentFailed(
            PaymentProvider.PAYSTACK,
            payload.data.reference,
            payload.data.gateway_response || 'Payment failed',
            payload.data.metadata || {},
          );
          break;

        case 'subscription.create':
          await this.webhookService.handleSubscriptionCreated(
            PaymentProvider.PAYSTACK,
            {
              subscriptionCode: payload.data.subscription_code,
              planCode: payload.data.plan?.plan_code,
              customerCode: payload.data.customer?.customer_code,
              customerEmail: payload.data.customer?.email,
            },
          );
          break;

        case 'invoice.update':
          // Only handle successful renewals
          if (
            payload.data.paid &&
            payload.data.subscription?.subscription_code
          ) {
            await this.webhookService.handleSubscriptionRenewed(
              PaymentProvider.PAYSTACK,
              {
                subscriptionCode: payload.data.subscription.subscription_code,
                amount: payload.data.amount,
                currency: payload.data.transaction?.currency || 'NGN',
                reference: payload.data.transaction?.reference,
              },
            );
          }
          break;

        case 'invoice.payment_failed':
          if (payload.data.subscription?.subscription_code) {
            await this.webhookService.handleInvoicePaymentFailed(
              PaymentProvider.PAYSTACK,
              {
                subscriptionCode: payload.data.subscription.subscription_code,
                description: payload.data.description,
              },
            );
          }
          break;

        case 'invoice.create':
          break;

        case 'subscription.disable':
        case 'subscription.not_renew':
          await this.webhookService.handleSubscriptionCancelled(
            PaymentProvider.PAYSTACK,
            payload.data.subscription_code,
          );
          break;

        default:
          this.logger.warn(`Unhandled Paystack event: ${payload.event}`);
      }

      await this.webhookService.markEventProcessed(webhookEvent.id);
    } catch (error) {
      await this.webhookService.markEventProcessed(
        webhookEvent.id,
        (error as { message: string }).message,
      );
      throw error;
    }

    return { status: 'success' };
  }
}
