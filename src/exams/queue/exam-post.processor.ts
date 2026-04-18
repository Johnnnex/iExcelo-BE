import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger, forwardRef } from '@nestjs/common';
import { Job } from 'bullmq';
import { StudentsService } from '../../students/students.service';
import { LoggerService } from '../../logger/logger.service';
import {
  EXAM_POST_QUEUE,
  ExamPostJobs,
  ExamQuestionBatchJobData,
  ExamLifetimeMetricsJobData,
  ExamLogEventJobData,
} from './exam-post.queue';
import { LogActionTypes, LogSeverity } from '../../../types';

@Processor(EXAM_POST_QUEUE)
export class ExamPostProcessor extends WorkerHost {
  private readonly logger = new Logger(ExamPostProcessor.name);

  constructor(
    @Inject(forwardRef(() => StudentsService))
    private readonly studentsService: StudentsService,
    private readonly loggerService: LoggerService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case ExamPostJobs.QUESTION_BATCH:
        await this.handleQuestionBatch(job as Job<ExamQuestionBatchJobData>);
        break;
      case ExamPostJobs.LIFETIME_METRICS:
        await this.handleLifetimeMetrics(
          job as Job<ExamLifetimeMetricsJobData>,
        );
        break;
      case ExamPostJobs.LOG_EVENT:
        await this.handleLogEvent(job as Job<ExamLogEventJobData>);
        break;
      default:
        this.logger.warn(`Unknown exam-post job: ${job.name}`);
    }
  }

  private async handleQuestionBatch(
    job: Job<ExamQuestionBatchJobData>,
  ): Promise<void> {
    const { studentId, questionResults, flagUpdates } = job.data;

    for (const result of questionResults) {
      if (result.isFlagged) {
        await this.studentsService.upsertFlaggedQuestion(
          studentId,
          result.questionId,
          { flagType: result.flagType, reason: result.flagReason },
        );
      }
      await this.studentsService.updateQuestionProgress(
        studentId,
        result.questionId,
        result.isCorrect,
        result.exemptFromMetrics,
      );
    }

    if (flagUpdates?.length) {
      for (const update of flagUpdates) {
        if (update.isFlagged) {
          await this.studentsService.upsertFlaggedQuestion(
            studentId,
            update.questionId,
            { flagType: update.flagType, reason: update.flagReason },
          );
        } else {
          await this.studentsService.removeFlaggedQuestion(
            studentId,
            update.questionId,
          );
        }
      }
    }
  }

  private async handleLifetimeMetrics(
    job: Job<ExamLifetimeMetricsJobData>,
  ): Promise<void> {
    const { studentId, totalAttempted, correctAnswers, wrongAnswers } =
      job.data;
    try {
      await this.studentsService.incrementLifetimeMetrics(
        studentId,
        totalAttempted,
        correctAnswers,
        wrongAnswers,
      );
    } catch (err: unknown) {
      this.logger.error(
        `incrementLifetimeMetrics failed for studentId=${studentId}: ${(err as Error)?.message}`,
      );
      throw err;
    }
  }

  private async handleLogEvent(job: Job<ExamLogEventJobData>): Promise<void> {
    const { userId, action, description, severity, metadata } = job.data;
    try {
      await this.loggerService.log({
        userId,
        action: action as LogActionTypes,
        description,
        severity: severity as LogSeverity,
        metadata,
      });
    } catch (err: unknown) {
      this.logger.error(
        `Exam log event failed for userId=${userId}, action=${action}: ${(err as Error)?.message}`,
      );
      throw err;
    }
  }
}
