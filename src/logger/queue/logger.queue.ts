export const LOGGER_QUEUE = 'logger';

export const LoggerJobs = {
  LOG_EVENT: 'log_event',
} as const;

export interface LogEventJobData {
  userId?: string | null;
  action: string;
  description: string;
  metadata?: Record<string, unknown>;
  severity?: string;
}
