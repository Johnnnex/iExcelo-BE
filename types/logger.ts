import { LogActionTypes, LogSeverity } from './enums';

export interface LogPayload {
  userId?: string;
  action: LogActionTypes;
  description: string;
  metadata?: any;
  severity?: LogSeverity;
}
