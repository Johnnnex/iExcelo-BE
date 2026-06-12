import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AdminService } from './admin.service';
import { AdminExamRevisionService } from './admin-exam-revision.service';
import { AdminUsersService } from './admin-users.service';
import { AdminSubscriptionsService } from './admin-subscriptions.service';
import { AdminTestimonialsService } from './admin-testimonials.service';
import { AdminBulkEmailsService } from './admin-bulk-emails.service';
import { AdminMessagesService } from './admin-messages.service';
import { AdminAnalyticsService } from './admin-analytics.service';
import {
  AdminAuthController,
  AdminManagementController,
  AdminRolesController,
  AdminDashboardController,
  AdminExamRevisionController,
  AdminStudentsController,
  AdminSponsorsController,
  AdminAffiliatesController,
  AdminSubscriptionsController,
  AdminTestimonialsController,
  AdminBulkEmailsController,
  AdminMessagesController,
  AdminAnalyticsController,
} from './admin.controller';
import { PasswordResetToken } from '../auth/entities/password-reset-tokens.entity';
import { AdminProfile } from './entities/admin-profile.entity';
import { AdminRole } from './entities/admin-role.entity';
import { AdminInvite } from './entities/admin-invite.entity';
import { Testimonial } from './entities/testimonial.entity';
import { BulkEmailCampaign } from './entities/bulk-email-campaign.entity';
import { User } from '../users/entities/user.entity';
import { StudentProfile } from '../students/entities/student-profile.entity';
import { SponsorProfile } from '../sponsors/entities/sponsor-profile.entity';
import { AffiliateProfile } from '../affiliates/entities/affiliate-profile.entity';
import { AffiliatePayout } from '../affiliates/entities/affiliate-payout.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { SubscriptionPlan } from '../subscriptions/entities/subscription-plan.entity';
import { ExamType } from '../exams/entities/exam-type.entity';
import { Subject } from '../exams/entities/subject.entity';
import { ExamTypeSubject } from '../exams/entities/exam-type-subject.entity';
import { Topic } from '../exams/entities/topic.entity';
import { Passage } from '../exams/entities/passage.entity';
import { Question } from '../exams/entities/question.entity';
import { MessageFlag } from '../chats/entities/message-flag.entity';
import { ChatMessage } from '../chats/entities/chat-message.entity';
import { ExamAttempt } from '../students/entities/exam-attempt.entity';
import { PlatformDailyAnalytics } from '../analytics/entities/platform-daily-analytics.entity';
import { StudentSubjectAnalytics } from '../analytics/entities/student-subject-analytics.entity';
import { AdminAccessGuard } from './guards/admin-access.guard';
import { AdminJwtGuard } from './guards/admin-jwt.guard';
import { AdminJwtStrategy } from './strategies/admin-jwt.strategy';
import { EMAILS_QUEUE } from '../email/queue/email.queue';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AdminProfile,
      AdminRole,
      AdminInvite,
      Testimonial,
      BulkEmailCampaign,
      PasswordResetToken,
      User,
      StudentProfile,
      SponsorProfile,
      AffiliateProfile,
      AffiliatePayout,
      Subscription,
      SubscriptionPlan,
      ExamType,
      Subject,
      ExamTypeSubject,
      Topic,
      Passage,
      Question,
      MessageFlag,
      ChatMessage,
      ExamAttempt,
      PlatformDailyAnalytics,
      StudentSubjectAnalytics,
    ]),

    BullModule.registerQueue({ name: EMAILS_QUEUE }),

    PassportModule,

    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),

    CacheModule.register({
      ttl: 5 * 60 * 1000, // 5 minutes in ms
    }),
  ],
  controllers: [
    AdminAuthController,
    AdminManagementController,
    AdminRolesController,
    AdminDashboardController,
    AdminExamRevisionController,
    AdminStudentsController,
    AdminSponsorsController,
    AdminAffiliatesController,
    AdminSubscriptionsController,
    AdminTestimonialsController,
    AdminBulkEmailsController,
    AdminMessagesController,
    AdminAnalyticsController,
  ],
  providers: [
    AdminService,
    AdminExamRevisionService,
    AdminUsersService,
    AdminSubscriptionsService,
    AdminTestimonialsService,
    AdminBulkEmailsService,
    AdminMessagesService,
    AdminAnalyticsService,
    AdminAccessGuard,
    AdminJwtGuard,
    AdminJwtStrategy,
  ],
  exports: [AdminAccessGuard],
})
export class AdminModule {}
