/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
// src/common/interceptors/logging.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { LoggerService } from '../../logger/logger.service';
import { LogActionTypes, LogSeverity } from '../../../types';
import { Reflector } from '@nestjs/core';
import { LOG_ACTION_KEY, SKIP_LOGGING_KEY } from '../decorators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(
    private loggerService: LoggerService,
    private reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // Check if route has @SkipLogging decorator
    const skipLogging = this.reflector.getAllAndOverride<boolean>(
      SKIP_LOGGING_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (skipLogging) {
      return next.handle(); // Skip logging, just pass through
    }

    const customAction = this.reflector.get<LogActionTypes>(
      LOG_ACTION_KEY,
      context.getHandler(),
    );

    const request = context.switchToHttp().getRequest();
    const { method, url, ip, headers } = request;
    const userAgent = headers['user-agent'] || '';
    const userId = request.user?.userId || null;

    const now = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse();
          const delay = Date.now() - now;

          // Log successful requests
          this.loggerService.log({
            userId,
            action: customAction || this.mapMethodToAction(method), // If custom action exists, use it; otherwise use CRUD mapping
            description: `${method} ${url} - ${response.statusCode}`,
            metadata: {
              method,
              url,
              statusCode: response.statusCode,
              responseTime: `${delay}ms`,
              ip,
              userAgent,
            },
            severity: LogSeverity.INFO,
          });
        },
        error: (error) => {
          const delay = Date.now() - now;

          // Log failed requests
          this.loggerService.log({
            userId,
            action: LogActionTypes.ERROR,
            description: `${method} ${url} - Error: ${error.message}`,
            metadata: {
              method,
              url,
              statusCode: error.status || 500,
              responseTime: `${delay}ms`,
              ip,
              userAgent,
              error: error.message,
              stack: error.stack,
            },
            severity: LogSeverity.ERROR,
          });
        },
      }),
    );
  }

  private mapMethodToAction(method: string): LogActionTypes {
    const actionMap: Record<string, LogActionTypes> = {
      GET: LogActionTypes.READ,
      POST: LogActionTypes.CREATE,
      PUT: LogActionTypes.UPDATE,
      PATCH: LogActionTypes.UPDATE,
      DELETE: LogActionTypes.DELETE,
    };

    return actionMap[method] || LogActionTypes.OTHER;
  }
}
