import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SponsorsService } from './sponsors.service';
import { SponsorsController } from './sponsors.controller';
import { SponsorProfile } from './entities/sponsor-profile.entity';
import { SponsorUrl } from './entities/sponsor-url.entity';
import { SponsorStudentInvite } from './entities/sponsor-student-invite.entity';
import { Giveback } from './entities/giveback.entity';
import { LoggerModule } from '../logger/logger.module';
import { UsersModule } from '../users/users.module';
import { StudentsModule } from '../students/students.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { AffiliatesModule } from '../affiliates/affiliates.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SponsorProfile,
      SponsorUrl,
      SponsorStudentInvite,
      Giveback,
    ]),
    LoggerModule,
    UsersModule,
    forwardRef(() => StudentsModule), // StudentsModule → SubscriptionsModule (no cycle, forwardRef just in case)
    SubscriptionsModule,
    AffiliatesModule,
  ],
  controllers: [SponsorsController],
  providers: [SponsorsService],
  exports: [SponsorsService],
})
export class SponsorsModule {}
