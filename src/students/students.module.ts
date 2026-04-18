import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ANALYTICS_QUEUE } from '../analytics/queue/analytics.queue';
import { StudentsService } from './students.service';
import { StudentsController } from './students.controller';
import { StudentProfile } from './entities/student-profile.entity';
import { StudentExamType } from './entities/student-exam-type.entity';
import { StudentExamTypeSubject } from './entities/student-exam-type-subject.entity';
import { ExamAttempt } from './entities/exam-attempt.entity';
import { QuestionProgress } from './entities/question-progress.entity';
import { FlaggedQuestion } from './entities/flagged-question.entity';
import { AnalyticsModule } from '../analytics/analytics.module';
import { ExamsModule } from '../exams/exams.module';
import { LoggerModule } from '../logger/logger.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { StudentActivityInterceptor } from './interceptors';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StudentProfile,
      StudentExamType,
      StudentExamTypeSubject,
      ExamAttempt,
      QuestionProgress,
      FlaggedQuestion,
    ]),
    BullModule.registerQueue({ name: ANALYTICS_QUEUE }),
    LoggerModule,
    AnalyticsModule,
    forwardRef(() => SubscriptionsModule),
    forwardRef(() => ExamsModule),
  ],
  controllers: [StudentsController],
  providers: [StudentsService, StudentActivityInterceptor],
  exports: [StudentsService], // Export for use in AuthModule and ExamsModule
})
export class StudentsModule {}
