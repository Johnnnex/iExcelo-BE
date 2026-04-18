export const EXAM_POST_QUEUE = 'exam-post';

export const ExamPostJobs = {
  QUESTION_BATCH: 'exam_question_batch',
  LIFETIME_METRICS: 'exam_lifetime_metrics',
  LOG_EVENT: 'exam_log_event',
} as const;

export interface ExamQuestionBatchJobData {
  studentId: string;
  /** Per-answered-question updates (progress tracking + inline flags) */
  questionResults: Array<{
    questionId: string;
    isCorrect: boolean | null; // null for essays (exemptFromMetrics)
    exemptFromMetrics: boolean;
    isFlagged: boolean;
    flagType?: string;
    flagReason?: string;
  }>;
  /** Explicit flag updates submitted alongside the exam (unanswered flags + removals) */
  flagUpdates?: Array<{
    questionId: string;
    isFlagged: boolean;
    flagType?: string;
    flagReason?: string;
  }>;
}

export interface ExamLifetimeMetricsJobData {
  studentId: string;
  totalAttempted: number;
  correctAnswers: number;
  wrongAnswers: number;
}

export interface ExamLogEventJobData {
  userId: string;
  action: string;
  description: string;
  severity: string;
  metadata: Record<string, unknown>;
}
