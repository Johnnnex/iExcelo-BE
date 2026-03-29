import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

// Entities
import {
  Subscription,
  SubscriptionPlan,
  Transaction,
  WebhookEvent,
  RegionCurrency,
  PlanPrice,
} from './entities';

// External entities needed for isPaid updates
import { StudentExamType } from '../students/entities/student-exam-type.entity';

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

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Subscription,
      SubscriptionPlan,
      Transaction,
      WebhookEvent,
      RegionCurrency,
      PlanPrice,
      StudentExamType,
    ]),
    ConfigModule,
    LoggerModule,
    AnalyticsModule,
    AffiliatesModule,
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
