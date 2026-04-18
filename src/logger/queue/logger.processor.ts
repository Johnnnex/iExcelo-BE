import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivityLog } from '../eniities/logger.entity';
import { LOGGER_QUEUE, LoggerJobs, LogEventJobData } from './logger.queue';
import { LogActionTypes, LogSeverity } from '../../../types';

@Processor(LOGGER_QUEUE)
export class LoggerProcessor extends WorkerHost {
  private readonly logger = new Logger(LoggerProcessor.name);

  constructor(
    @InjectRepository(ActivityLog)
    private readonly activityLogRepo: Repository<ActivityLog>,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== LoggerJobs.LOG_EVENT) {
      this.logger.warn(`Unknown logger job: ${job.name}`);
      return;
    }

    await this.handleLogEvent(job as Job<LogEventJobData>);
  }

  private async handleLogEvent(job: Job<LogEventJobData>): Promise<void> {
    const { userId, action, description, metadata, severity } = job.data;
    try {
      const log = this.activityLogRepo.create({
        userId: (userId || null) as string,
        action: action as LogActionTypes,
        description,
        metadata: metadata || {},
        severity: (severity as LogSeverity) || LogSeverity.INFO,
      });
      await this.activityLogRepo.save(log);
    } catch (err: unknown) {
      this.logger.error(
        `Failed to persist activity log: ${(err as Error)?.message}`,
      );
      throw err;
    }
  }
}
