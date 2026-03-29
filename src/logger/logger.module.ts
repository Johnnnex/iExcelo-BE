import { Module } from '@nestjs/common';
import { LoggerService } from './logger.service';
import { ActivityLog } from './eniities/logger.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([ActivityLog])],
  providers: [LoggerService],
  exports: [LoggerService],
})
export class LoggerModule {}
