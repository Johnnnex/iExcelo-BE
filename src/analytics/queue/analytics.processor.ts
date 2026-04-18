import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AnalyticsService } from '../analytics.service';
import {
  ANALYTICS_QUEUE,
  AnalyticsJobs,
  UpdateDailyAnalyticsJobData,
  UpdateSubjectAnalyticsBatchJobData,
  TrackPlatformAnalyticsJobData,
  TrackAffiliateDailyAnalyticsJobData,
  UpdateStudentStreakJobData,
} from './analytics.queue';

@Processor(ANALYTICS_QUEUE)
export class AnalyticsProcessor extends WorkerHost {
  private readonly logger = new Logger(AnalyticsProcessor.name);

  constructor(private readonly analyticsService: AnalyticsService) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case AnalyticsJobs.UPDATE_DAILY:
        await this.handleUpdateDaily(job as Job<UpdateDailyAnalyticsJobData>);
        break;
      case AnalyticsJobs.UPDATE_SUBJECT_BATCH:
        await this.handleUpdateSubjectBatch(
          job as Job<UpdateSubjectAnalyticsBatchJobData>,
        );
        break;
      case AnalyticsJobs.TRACK_PLATFORM:
        await this.handleTrackPlatform(
          job as Job<TrackPlatformAnalyticsJobData>,
        );
        break;
      case AnalyticsJobs.TRACK_AFFILIATE_DAILY:
        await this.handleTrackAffiliateDaily(
          job as Job<TrackAffiliateDailyAnalyticsJobData>,
        );
        break;
      case AnalyticsJobs.UPDATE_STREAK:
        await this.handleUpdateStreak(job as Job<UpdateStudentStreakJobData>);
        break;
      default:
        this.logger.warn(`Unknown analytics job: ${job.name}`);
    }
  }

  private async handleUpdateDaily(
    job: Job<UpdateDailyAnalyticsJobData>,
  ): Promise<void> {
    const { studentId, examTypeId, data } = job.data;
    try {
      await this.analyticsService.updateDailyAnalytics(
        studentId,
        examTypeId,
        data,
      );
    } catch (err: unknown) {
      this.logger.error(
        `updateDailyAnalytics failed for studentId=${studentId}: ${(err as Error)?.message}`,
      );
      throw err;
    }
  }

  private async handleUpdateSubjectBatch(
    job: Job<UpdateSubjectAnalyticsBatchJobData>,
  ): Promise<void> {
    const { studentId, examTypeId, subjects } = job.data;
    for (const { subjectId, data } of subjects) {
      try {
        await this.analyticsService.updateSubjectAnalytics(
          studentId,
          examTypeId,
          subjectId,
          data,
        );
      } catch (err: unknown) {
        this.logger.error(
          `updateSubjectAnalytics failed for studentId=${studentId}, subjectId=${subjectId}: ${(err as Error)?.message}`,
        );
        throw err;
      }
    }
  }

  private async handleTrackPlatform(
    job: Job<TrackPlatformAnalyticsJobData>,
  ): Promise<void> {
    try {
      await this.analyticsService.trackPlatformAnalytics(job.data.data);
    } catch (err: unknown) {
      this.logger.error(
        `trackPlatformAnalytics failed: ${(err as Error)?.message}`,
      );
      throw err;
    }
  }

  private async handleTrackAffiliateDaily(
    job: Job<TrackAffiliateDailyAnalyticsJobData>,
  ): Promise<void> {
    const { affiliateId, data } = job.data;
    try {
      await this.analyticsService.trackAffiliateDailyAnalytics(
        affiliateId,
        data,
      );
    } catch (err: unknown) {
      this.logger.error(
        `trackAffiliateDailyAnalytics failed for affiliateId=${affiliateId}: ${(err as Error)?.message}`,
      );
      throw err;
    }
  }

  private async handleUpdateStreak(
    job: Job<UpdateStudentStreakJobData>,
  ): Promise<void> {
    const { studentId } = job.data;
    try {
      await this.analyticsService.updateStudentStreak(studentId);
    } catch (err: unknown) {
      this.logger.error(
        `updateStudentStreak failed for studentId=${studentId}: ${(err as Error)?.message}`,
      );
      throw err;
    }
  }
}
