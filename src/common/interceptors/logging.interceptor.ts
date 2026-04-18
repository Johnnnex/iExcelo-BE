/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
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
import { SKIP_LOGGING_KEY } from '../decorators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(
    private loggerService: LoggerService,
    private reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const skipLogging = this.reflector.getAllAndOverride<boolean>(
      SKIP_LOGGING_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (skipLogging) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const { method, url, ip, headers } = request;
    const userAgent = headers['user-agent'] || '';
    const userId = request.user?.userId || null;
    const now = Date.now();

    return next.handle().pipe(
      tap({
        error: (error) => {
          const delay = Date.now() - now;

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
}
