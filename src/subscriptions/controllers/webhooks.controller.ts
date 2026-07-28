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
        case 'checkout.session.completed':
        case 'customer.created':
        case 'payment_method.attached':
        case 'invoice.created':
        case 'invoice.finalized':
        case 'charge.succeeded':
        case 'invoice_payment.paid':
          // Informational events fired as side effects of the checkout flow.
          // invoice_payment.paid is a newer alias; invoice.paid fires alongside it
          // and handles activation. Acknowledge these to suppress WARN logs.
          break;

        case 'invoice.paid':
        case 'invoice.payment_succeeded': {
          const invoice = event.data.object;

          // subscription_data.metadata is echoed on every invoice under
          // subscription_details.metadata — this is where our subscriptionId lives.
          // invoice.metadata itself is always empty for subscription invoices.
          const subMeta =
            invoice.subscription_details?.metadata || invoice.metadata || {};
          const subscriptionId: string | undefined = subMeta.subscriptionId;

          const stripeCard =
            invoice.payment_intent?.payment_method_details?.card ??
            invoice.charge?.payment_method_details?.card ??
            null;
          const cardInfo = stripeCard
            ? {
                brand: stripeCard.brand ?? null,
                last4: stripeCard.last4 ?? null,
                expMonth: stripeCard.exp_month
                  ? String(stripeCard.exp_month)
                  : null,
                expYear: stripeCard.exp_year
                  ? String(stripeCard.exp_year)
                  : null,
                bank: null,
                channel: 'card',
              }
            : undefined;

          const customerInfo = {
            email: invoice.customer_email ?? undefined,
            customerCode: invoice.customer as string,
          };

          const paymentData = {
            amount: invoice.amount_paid,
            currency: invoice.currency,
          };

          if (invoice.billing_reason === 'subscription_cycle') {
            // Renewal — extend the existing subscription period
            const subscriptionCode = invoice.subscription as string;
            await this.webhookService.handleSubscriptionRenewed(
              PaymentProvider.STRIPE,
              {
                subscriptionCode,
                amount: invoice.amount_paid,
                currency: invoice.currency,
                reference: invoice.id,
                cardInfo,
              },
            );
          } else {
            // First payment (billing_reason = 'subscription_create' or 'manual')
            await this.webhookService.handlePaymentSucceeded(
              PaymentProvider.STRIPE,
              invoice.id,
              { subscriptionId },
              customerInfo,
              paymentData,
              cardInfo,
            );
          }
          break;
        }

        case 'payment_intent.payment_failed':
        case 'invoice.payment_failed':
          await this.webhookService.handlePaymentFailed(
            PaymentProvider.STRIPE,
            event.data.object.id,
            event.data.object.last_payment_error?.message || 'Payment failed',
            event.data.object.metadata || {},
          );
          break;

        case 'customer.subscription.created': {
          const stripeSub = event.data.object;
          // subscription_data.metadata carries our subscriptionId — use it for
          // a direct match instead of plan-code matching (plan codes are dynamic
          // Stripe IDs when pre-configured stripePriceIds aren't set).
          const subscriptionId: string | undefined =
            stripeSub.metadata?.subscriptionId;
          if (subscriptionId) {
            await this.webhookService.handleSubscriptionCreated(
              PaymentProvider.STRIPE,
              {
                subscriptionCode: stripeSub.id,
                planCode: '',
                customerCode: stripeSub.customer as string,
                customerEmail: '',
                // Direct DB subscription ID — skip plan-code matching entirely
                directSubscriptionId: subscriptionId,
              },
            );
          } else {
            // Fallback: match by planCode (only works if stripePriceId is configured)
            await this.webhookService.handleSubscriptionCreated(
              PaymentProvider.STRIPE,
              {
                subscriptionCode: stripeSub.id,
                planCode: stripeSub.items?.data?.[0]?.price?.id || '',
                customerCode: stripeSub.customer as string,
                customerEmail: stripeSub.customer_email || '',
              },
            );
          }
          break;
        }

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
            // Card info from authorization object — saved to subscription for display
            payload.data.authorization
              ? {
                  brand: payload.data.authorization.brand ?? null,
                  last4: payload.data.authorization.last4 ?? null,
                  expMonth: payload.data.authorization.exp_month ?? null,
                  expYear: payload.data.authorization.exp_year ?? null,
                  bank: payload.data.authorization.bank ?? null,
                  channel: payload.data.authorization.channel ?? null,
                }
              : undefined,
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
            const renewalAuth = payload.data.transaction?.authorization;
            await this.webhookService.handleSubscriptionRenewed(
              PaymentProvider.PAYSTACK,
              {
                subscriptionCode: payload.data.subscription.subscription_code,
                amount: payload.data.amount,
                currency: payload.data.transaction?.currency || 'NGN',
                reference: payload.data.transaction?.reference,
                cardInfo: renewalAuth
                  ? {
                      brand: renewalAuth.brand ?? null,
                      last4: renewalAuth.last4 ?? null,
                      expMonth: renewalAuth.exp_month ?? null,
                      expYear: renewalAuth.exp_year ?? null,
                      bank: renewalAuth.bank ?? null,
                      channel: renewalAuth.channel ?? null,
                    }
                  : undefined,
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
