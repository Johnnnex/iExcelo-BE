import { SetMetadata } from '@nestjs/common';
import { LogActionTypes } from '../../../types';

export const LOG_ACTION_KEY = 'customLogAction';

export const LogAction = (action: LogActionTypes) =>
  SetMetadata(LOG_ACTION_KEY, action);

// This is for the logger, to specify what action the particular log should have (For specific endpoints like sign up, login, etc)
