/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivityLog } from './eniities/logger.entity';
import { LogActionTypes, LogPayload, LogSeverity } from '../../types';

@Injectable()
export class LoggerService {
  constructor(
    @InjectRepository(ActivityLog)
    private activityLogRepo: Repository<ActivityLog>,
  ) {}

  async log(payload: LogPayload): Promise<ActivityLog> {
    const log = this.activityLogRepo.create({
      userId: (payload.userId || null) as string,
      action: payload.action,
      description: payload.description,
      metadata: payload.metadata || {},
      severity: payload.severity || LogSeverity.INFO,
    });

    return this.activityLogRepo.save(log);
  }

  // Convenience methods
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

  // Query logs
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
