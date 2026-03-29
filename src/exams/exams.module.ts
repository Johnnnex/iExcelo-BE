import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExamsService } from './exams.service';
import { ExamsController } from './exams.controller';
import { GradingService } from './services/grading.service';
import { ExamType } from './entities/exam-type.entity';
import { Subject } from './entities/subject.entity';
import { Question } from './entities/question.entity';
import { Passage } from './entities/passage.entity';
import { ExamConfig } from './entities/exam-config.entity';
import { ExamTypeSubject } from './entities/exam-type-subject.entity';
import { Topic } from './entities/topic.entity';
import { StudentsModule } from '../students/students.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { LoggerModule } from '../logger/logger.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ExamType,
      Subject,
      ExamTypeSubject,
      Question,
      Passage,
      ExamConfig,
      Topic,
    ]),
    AnalyticsModule,
    LoggerModule,
    forwardRef(() => StudentsModule),
  ],
  controllers: [ExamsController],
  providers: [ExamsService, GradingService],
  exports: [ExamsService],
})
export class ExamsModule {}
