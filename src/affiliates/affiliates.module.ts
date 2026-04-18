import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AffiliatesService } from './affiliates.service';
import { AffiliatesController } from './affiliates.controller';
import { AffiliateProfile } from './entities/affiliate-profile.entity';
import { AffiliateReferral } from './entities/affiliate-referral.entity';
import { Commission } from './entities/commission.entity';
import { AffiliatePayout } from './entities/affiliate-payout.entity';
import { LoggerModule } from '../logger/logger.module';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AffiliateProfile,
      AffiliateReferral,
      Commission,
      AffiliatePayout,
    ]),
    LoggerModule,
    AnalyticsModule,
  ],
  controllers: [AffiliatesController],
  providers: [AffiliatesService],
  exports: [AffiliatesService],
})
export class AffiliatesModule {}
