import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsService } from './analytics.service';
import { StudentDailyAnalytics } from './entities/student-daily-analytics.entity';
import { StudentSubjectAnalytics } from './entities/student-subject-analytics.entity';
import { StudentStreak } from './entities/student-streak.entity';
import { AffiliateDailyAnalytics } from './entities/affiliate-daily-analytics.entity';
import { AffiliatePayout } from './entities/affiliate-payout.entity';
import { PlatformDailyAnalytics } from './entities/platform-daily-analytics.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StudentDailyAnalytics,
      StudentSubjectAnalytics,
      StudentStreak,
      AffiliateDailyAnalytics,
      AffiliatePayout,
      PlatformDailyAnalytics,
    ]),
  ],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
