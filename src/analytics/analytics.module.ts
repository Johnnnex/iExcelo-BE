import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { AnalyticsService } from './analytics.service';
import { AnalyticsProcessor } from './queue/analytics.processor';
import { ANALYTICS_QUEUE } from './queue/analytics.queue';
import { StudentDailyAnalytics } from './entities/student-daily-analytics.entity';
import { StudentSubjectAnalytics } from './entities/student-subject-analytics.entity';
import { StudentStreak } from './entities/student-streak.entity';
import { AffiliateDailyAnalytics } from './entities/affiliate-daily-analytics.entity';
import { PlatformDailyAnalytics } from './entities/platform-daily-analytics.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StudentDailyAnalytics,
      StudentSubjectAnalytics,
      StudentStreak,
      AffiliateDailyAnalytics,
      PlatformDailyAnalytics,
    ]),
    BullModule.registerQueue({ name: ANALYTICS_QUEUE }),
  ],
  providers: [AnalyticsService, AnalyticsProcessor],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
