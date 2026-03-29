/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { StudentsService } from '../students.service';
import type { User } from '../../users/entities/user.entity';

/**
 * Intercepts all requests to the students controller.
 * Records daily activity for streak tracking (fire-and-forget).
 *
 * Any authenticated request to a student endpoint counts as a "check-in".
 * The streak logic:
 * - Same day: do nothing (already counted)
 * - Consecutive day: increment currentStreak, update longestStreak if new record
 * - Gap > 1 day: reset currentStreak to 1
 */
@Injectable()
export class StudentActivityInterceptor implements NestInterceptor {
  constructor(private studentsService: StudentsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as User;

    // Only track if user is authenticated
    if (user?.id) {
      // Fire-and-forget: don't await, don't block the request
      // TODO: Move to RabbitMQ/Kafka - non-blocking streak update
      this.studentsService.recordDailyCheckIn(user.id).catch(() => {
        // Silently ignore errors - streak tracking should never block user requests
      });
    }

    return next.handle();
  }
}
