import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ANALYTICS_QUEUE } from '../analytics/queue/analytics.queue';
import { EMAILS_QUEUE } from '../email/queue/email.queue';

// Entities
import {
  Subscription,
  SubscriptionPlan,
  Transaction,
  WebhookEvent,
  RegionCurrency,
  PlanPrice,
  PlanPriceProvider,
} from './entities';

// Services
import { SubscriptionsService } from './subscriptions.service';
import {
  TransactionsService,
  WebhookService,
  SubscriptionPlansService,
  CheckoutService,
} from './services';

// Controllers
import { SubscriptionsController } from './subscriptions.controller';
import { WebhooksController } from './controllers';

// External modules
import { LoggerModule } from '../logger/logger.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { AffiliatesModule } from '../affiliates/affiliates.module';
import { StudentsModule } from '../students/students.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Subscription,
      SubscriptionPlan,
      Transaction,
      WebhookEvent,
      RegionCurrency,
      PlanPrice,
      PlanPriceProvider,
    ]),
    ConfigModule,
    BullModule.registerQueue({ name: ANALYTICS_QUEUE }),
    BullModule.registerQueue({ name: EMAILS_QUEUE }),
    LoggerModule,
    AnalyticsModule,
    AffiliatesModule,
    forwardRef(() => StudentsModule),
  ],
  controllers: [SubscriptionsController, WebhooksController],
  providers: [
    SubscriptionsService,
    TransactionsService,
    WebhookService,
    SubscriptionPlansService,
    CheckoutService,
  ],
  exports: [
    SubscriptionsService,
    TransactionsService,
    WebhookService,
    SubscriptionPlansService,
    CheckoutService,
  ],
})
export class SubscriptionsModule {}
