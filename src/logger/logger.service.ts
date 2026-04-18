/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { ActivityLog } from './eniities/logger.entity';
import { LogActionTypes, LogPayload, LogSeverity } from '../../types';
import { LOGGER_QUEUE, LoggerJobs } from './queue/logger.queue';

@Injectable()
export class LoggerService {
  constructor(
    @InjectRepository(ActivityLog)
    private activityLogRepo: Repository<ActivityLog>,
    @InjectQueue(LOGGER_QUEUE)
    private readonly loggerQueue: Queue,
  ) {}

  async log(payload: LogPayload): Promise<void> {
    await this.loggerQueue.add(
      LoggerJobs.LOG_EVENT,
      {
        userId: payload.userId || null,
        action: payload.action,
        description: payload.description,
        metadata: payload.metadata || {},
        severity: payload.severity || LogSeverity.INFO,
      },
      { attempts: 3, backoff: { type: 'fixed', delay: 1000 } },
    );
  }

  async info(description: string, userId?: string, metadata?: any) {
    return this.log({
      userId,
      action: LogActionTypes.OTHER,
      description,
      metadata,
      severity: LogSeverity.INFO,
    });
  }

  async warn(description: string, userId?: string, metadata?: any) {
    return this.log({
      userId,
      action: LogActionTypes.OTHER,
      description,
      metadata,
      severity: LogSeverity.WARNING,
    });
  }

  async error(description: string, userId?: string, metadata?: any) {
    return this.log({
      userId,
      action: LogActionTypes.ERROR,
      description,
      metadata,
      severity: LogSeverity.ERROR,
    });
  }

  async critical(description: string, userId?: string, metadata?: any) {
    return this.log({
      userId,
      action: LogActionTypes.ERROR,
      description,
      metadata,
      severity: LogSeverity.CRITICAL,
    });
  }

  async findByUser(userId: string, limit = 50) {
    return this.activityLogRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async findByAction(action: LogActionTypes, limit = 50) {
    return this.activityLogRepo.find({
      where: { action },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async findBySeverity(severity: LogSeverity, limit = 50) {
    return this.activityLogRepo.find({
      where: { severity },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
