import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { LoggerService } from './logger.service';
import { LoggerProcessor } from './queue/logger.processor';
import { ActivityLog } from './eniities/logger.entity';
import { LOGGER_QUEUE } from './queue/logger.queue';

@Module({
  imports: [
    TypeOrmModule.forFeature([ActivityLog]),
    BullModule.registerQueue({ name: LOGGER_QUEUE }),
  ],
  providers: [LoggerService, LoggerProcessor],
  exports: [LoggerService],
})
export class LoggerModule {}
