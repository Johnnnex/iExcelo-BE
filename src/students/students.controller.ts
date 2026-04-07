import {
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { StudentsService } from './students.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { JwtAuthGuard } from '../common/guards';
import { StudentActivityInterceptor } from './interceptors';
import type { Request } from 'express';
import type { User } from '../users/entities/user.entity';

/**
 * Student controller with activity tracking interceptor.
 * The StudentActivityInterceptor records daily check-ins for streak tracking
 * on every authenticated request (fire-and-forget, non-blocking).
 */
@Controller('students')
@UseInterceptors(StudentActivityInterceptor)
export class StudentsController {
  constructor(
    private readonly studentsService: StudentsService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  @Get('dashboard')
  @UseGuards(JwtAuthGuard)
  async getDashboard(
    @Req() req: Request & { user: User },
    @Query('examTypeId') examTypeId?: string,
    @Query('granularity') granularity?: string,
    @Query('timezone') timezone?: string,
  ) {
    const resolvedGranularity = (
      ['day', 'week', 'month'].includes(granularity ?? '')
        ? granularity
        : 'month'
    ) as 'day' | 'week' | 'month';
    const dashboard = await this.studentsService.getStudentDashboard(
      req.user.id,
      examTypeId,
      resolvedGranularity,
      timezone || 'UTC',
    );

    return {
      success: true,
      message: 'Dashboard data retrieved successfully',
      data: dashboard,
    };
  }

  /**
   * Get paginated exam attempt history for the authenticated student.
   * GET /students/exam-history?page=1&limit=10
   */
  @Get('exam-history')
  @UseGuards(JwtAuthGuard)
  async getExamHistory(
    @Req() req: Request & { user: User },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.studentsService.getExamHistory(
      req.user.id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 10,
    );
    return {
      success: true,
      message: 'Exam history retrieved successfully',
      data: result,
    };
  }

  /**
   * Get full detail for a single exam attempt including per-question results.
   * GET /students/exam-history/:id?offset=0&limit=20
   * Returns metadata + questionStatuses (all) + paginated detailedResults.
   */
  @Get('exam-history/:id')
  @UseGuards(JwtAuthGuard)
  async getExamAttemptDetail(
    @Req() req: Request & { user: User },
    @Param('id') id: string,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const result = await this.studentsService.getExamAttemptDetail(
      req.user.id,
      id,
      offset,
      Math.min(limit, 100),
    );
    return {
      success: true,
      message: 'Exam attempt detail retrieved successfully',
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      data: result,
    };
  }

  /**
   * Paginated detailed results for a past attempt — no metadata overhead.
   * GET /students/exam-history/:id/questions?offset=&limit=
   */
  @Get('exam-history/:id/questions')
  @UseGuards(JwtAuthGuard)
  async getExamAttemptQuestions(
    @Req() req: Request & { user: User },
    @Param('id') id: string,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const result = await this.studentsService.getExamAttemptQuestions(
      req.user.id,
      id,
      offset,
      Math.min(limit, 100),
    );
    return {
      success: true,
      message: 'Questions retrieved',
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      data: result,
    };
  }

  // ─── Analytics Page Endpoints ────────────────────────────────────

  /**
   * Dashboard chart — Subject scores time-series for recharts AreaChart.
   * GET /students/analytics/subject-scores?examTypeId=&granularity=&timezone=
   * Returns { data: [{name, Subject1, Subject2, ...}], subjects: [{id,name}], granularity }
   */
  @Get('analytics/subject-scores')
  @UseGuards(JwtAuthGuard)
  async getSubjectScores(
    @Req() req: Request & { user: User },
    @Query('examTypeId') examTypeId: string,
    @Query('granularity') granularity?: string,
    @Query('timezone') timezone?: string,
  ) {
    const resolvedGranularity = (
      ['day', 'week', 'month'].includes(granularity ?? '')
        ? granularity
        : 'month'
    ) as 'day' | 'week' | 'month';
    const subjectScores = await this.studentsService.getSubjectScores(
      req.user.id,
      examTypeId,
      resolvedGranularity,
      timezone || 'UTC',
    );
    return {
      success: true,
      message: 'Subject scores retrieved successfully',
      data: subjectScores,
    };
  }

  /**
   * Analytics page Chart 1 — Score vs subject time-series filtered by date range.
   * GET /students/analytics/subject-accuracy?examTypeId=&startDate=&endDate=&timezone=
   * Returns { data: [{name, Subject1, ...}], subjects: [{id,name}], granularity }
   */
  @Get('analytics/subject-accuracy')
  @UseGuards(JwtAuthGuard)
  async getAnalyticsSubjectScores(
    @Req() req: Request & { user: User },
    @Query('examTypeId') examTypeId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('timezone') _timezone?: string,
  ) {
    const student = await this.studentsService.findStudentByUserId(req.user.id);
    const data = await this.studentsService.getAnalyticsSubjectScores(
      student.id,
      examTypeId,
      startDate,
      endDate,
    );
    return { success: true, message: 'Subject scores retrieved', data };
  }

  /**
   * Chart 2 — Questions attempted per day/week/month (calendar-relative to now).
   * GET /students/analytics/progress-over-time?examTypeId=&granularity=&timezone=
   */
  @Get('analytics/progress-over-time')
  @UseGuards(JwtAuthGuard)
  async getAnalyticsProgressOverTime(
    @Req() req: Request & { user: User },
    @Query('examTypeId') examTypeId: string,
    @Query('granularity') granularity?: string,
    @Query('timezone') timezone?: string,
  ) {
    const g = (
      ['day', 'week', 'month'].includes(granularity ?? '')
        ? granularity
        : 'month'
    ) as 'day' | 'week' | 'month';
    const student = await this.studentsService.findStudentByUserId(req.user.id);
    const data = await this.studentsService.getAnalyticsProgressOverTime(
      student.id,
      examTypeId,
      g,
      timezone || 'UTC',
    );
    return { success: true, message: 'Progress over time retrieved', data };
  }

  /**
   * Chart 3 — All-time question distribution (correct vs wrong).
   * GET /students/analytics/question-distribution?examTypeId=
   */
  @Get('analytics/question-distribution')
  @UseGuards(JwtAuthGuard)
  async getAnalyticsQuestionDistribution(
    @Req() req: Request & { user: User },
    @Query('examTypeId') examTypeId: string,
  ) {
    const student = await this.studentsService.findStudentByUserId(req.user.id);
    const data = await this.studentsService.getAnalyticsQuestionDistribution(
      student.id,
      examTypeId,
    );
    return { success: true, message: 'Question distribution retrieved', data };
  }

  /**
   * Chart 4 — Student ranking vs peers by exam count in date range.
   * GET /students/analytics/ranking?examTypeId=&startDate=&endDate=
   */
  @Get('analytics/ranking')
  @UseGuards(JwtAuthGuard)
  async getAnalyticsStudentRanking(
    @Req() req: Request & { user: User },
    @Query('examTypeId') examTypeId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const student = await this.studentsService.findStudentByUserId(req.user.id);
    const data = await this.studentsService.getAnalyticsStudentRanking(
      student.id,
      examTypeId,
      startDate,
      endDate,
    );
    return { success: true, message: 'Student ranking retrieved', data };
  }

  /**
   * Chart 5 — Questions attempted per subject for the selected period.
   * GET /students/analytics/subject-attempts?examTypeId=&granularity=&period=&timezone=
   */
  @Get('analytics/subject-attempts')
  @UseGuards(JwtAuthGuard)
  async getAnalyticsSubjectAttempts(
    @Req() req: Request & { user: User },
    @Query('examTypeId') examTypeId: string,
    @Query('granularity') granularity?: string,
    @Query('period') period?: string,
    @Query('timezone') timezone?: string,
  ) {
    const g = (
      ['day', 'week', 'month'].includes(granularity ?? '')
        ? granularity
        : 'month'
    ) as 'day' | 'week' | 'month';
    const student = await this.studentsService.findStudentByUserId(req.user.id);
    const data = await this.studentsService.getAnalyticsSubjectAttempts(
      student.id,
      examTypeId,
      g,
      period,
      timezone || 'UTC',
    );
    return { success: true, message: 'Subject attempts retrieved', data };
  }

  @Post()
  create(@Body() createStudentDto: CreateStudentDto) {
    const student = this.studentsService.create(createStudentDto);
    return {
      message: 'Student created successfully',
      data: student,
    };
  }

  @Get()
  findAll() {
    const students = this.studentsService.findAll();
    return {
      message: 'Students retrieved successfully',
      data: students,
    };
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    const student = this.studentsService.findOne(+id);
    return {
      message: 'Student retrieved successfully',
      data: student,
    };
  }

  @Patch('exam-type')
  @UseGuards(JwtAuthGuard)
  async switchExamType(
    @Req() req: Request & { user: User },
    @Body('examTypeId') examTypeId: string,
  ) {
    await this.studentsService.updateLastExamType(req.user.id, examTypeId);

    return {
      success: true,
      message: 'Exam type updated successfully',
    };
  }

  /**
   * Update subjects for a specific exam type.
   * Used when student completes profile setup or changes their subject selection.
   */
  @Patch('settings/subjects')
  @UseGuards(JwtAuthGuard)
  async updateSubjects(
    @Req() req: Request & { user: User },
    @Body('examTypeId') examTypeId: string,
    @Body('subjectIds') subjectIds: string[],
  ) {
    const result = await this.studentsService.updateSubjects(
      req.user.id,
      examTypeId,
      subjectIds,
    );

    return {
      success: true,
      message: 'Subjects updated successfully',
      data: result,
    };
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateStudentDto: UpdateStudentDto) {
    const student = this.studentsService.update(+id, updateStudentDto);
    return {
      message: 'Student updated successfully',
      data: student,
    };
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    this.studentsService.remove(+id);
    return {
      message: 'Student deleted successfully',
      data: null,
    };
  }

  // === SUBSCRIPTION ROUTES ===

  /**
   * Get current user's subscriptions
   * GET /students/subscriptions
   */
  @Get('subscriptions')
  @UseGuards(JwtAuthGuard)
  async getMySubscriptions(@Req() req: Request & { user: User }) {
    const studentId = req.user.studentProfile?.id;
    if (!studentId) {
      return {
        success: true,
        message: 'No student profile found',
        data: [],
      };
    }

    const subscriptions =
      await this.subscriptionsService.getStudentSubscriptions(studentId);
    return {
      success: true,
      message: 'Subscriptions retrieved successfully',
      data: subscriptions,
    };
  }

  /**
   * Get active subscription for an exam type
   * GET /students/subscriptions/active/:examTypeId
   */
  @Get('subscriptions/active/:examTypeId')
  @UseGuards(JwtAuthGuard)
  async getActiveSubscription(
    @Req() req: Request & { user: User },
    @Param('examTypeId') examTypeId: string,
  ) {
    const studentId = req.user.studentProfile?.id;
    if (!studentId) {
      return {
        success: true,
        message: 'No student profile found',
        data: null,
      };
    }

    const subscription = await this.subscriptionsService.findActiveSubscription(
      studentId,
      examTypeId,
    );
    return {
      success: true,
      message: subscription
        ? 'Active subscription found'
        : 'No active subscription',
      data: subscription,
    };
  }

  /**
   * Cancel a subscription
   * POST /students/subscriptions/:id/cancel
   */
  @Post('subscriptions/:id/cancel')
  @UseGuards(JwtAuthGuard)
  async cancelSubscription(
    @Req() req: Request & { user: User },
    @Param('id') subscriptionId: string,
  ) {
    await this.subscriptionsService.cancelSubscription(
      subscriptionId,
      req.user.id,
    );
    return {
      success: true,
      message: 'Subscription cancelled successfully',
    };
  }
}
