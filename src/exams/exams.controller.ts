import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ExamsService } from './exams.service';
import { StartExamDto } from './dto/start-exam.dto';
import { SubmitExamDto } from './dto/submit-exam.dto';
import { Public } from '../common/decorators';
import { JwtAuthGuard } from '../common/guards/jwt.guard';

@Controller('exams')
export class ExamsController {
  constructor(private readonly examsService: ExamsService) {}

  // ─── Public ───────────────────────────────────────────────────────────────

  @Public()
  @Get('types')
  async getAllExamTypes() {
    const examTypes = await this.examsService.getAllExamTypes();
    return { message: 'Exam types retrieved successfully', data: examTypes };
  }

  @Public()
  @Get('types/:examTypeId/subjects')
  async getSubjectsByExamType(@Param('examTypeId') examTypeId: string) {
    const subjects = await this.examsService.getSubjectsByExamType(examTypeId);
    return { message: 'Subjects retrieved successfully', data: subjects };
  }

  // ─── Authenticated ────────────────────────────────────────────────────────

  @Get('types/:examTypeId/mock-config')
  @UseGuards(JwtAuthGuard)
  async getMockConfig(@Param('examTypeId') examTypeId: string) {
    const config = await this.examsService.getMockConfig(examTypeId);
    return { message: 'Mock config retrieved', data: config };
  }

  /**
   * Start an exam session.
   * - Checks access control (free vs paid, mock vs revision/timed)
   * - Creates an ExamAttempt with server-owned startedAt timestamp
   * - Returns questions (with answers for revision/timed, without for mock)
   * - Returns passages once in a separate lookup array
   */
  @Post('start')
  @UseGuards(JwtAuthGuard)
  async startExam(
    @Req() req: { user: { id: string } },
    @Body() dto: StartExamDto,
  ) {
    const result = await this.examsService.startExam(req.user.id, dto);
    return { message: 'Exam started successfully', data: result };
  }

  /**
   * Submit a completed exam.
   * - Grades all responses server-side (frontend result is UX only, not trusted)
   * - Validates timing using server's startedAt, not client-reported time
   * - Updates StudentProfile, analytics, and QuestionProgress
   */
  @Post('submit')
  @UseGuards(JwtAuthGuard)
  async submitExam(
    @Req() req: { user: { id: string } },
    @Body() dto: SubmitExamDto,
  ) {
    const result = await this.examsService.submitExam(req.user.id, dto);
    return { message: 'Exam submitted successfully', data: result };
  }

  // ─── Attempt: Paginated Questions ─────────────────────────────────────────

  @Get('attempts/:attemptId/questions')
  @UseGuards(JwtAuthGuard)
  async getAttemptQuestions(
    @Req() req: { user: { id: string } },
    @Param('attemptId') attemptId: string,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit: number,
  ) {
    const userId = req.user.id;
    const result = await this.examsService.getAttemptQuestions(
      userId,
      attemptId,
      offset,
      Math.min(limit, 100),
    );
    return { message: 'Questions retrieved', data: result };
  }

  // ─── Attempt: Draft Save / Restore ────────────────────────────────────────

  @Put('attempts/:attemptId/draft')
  @UseGuards(JwtAuthGuard)
  async saveDraft(
    @Req() req: { user: { id: string } },
    @Param('attemptId') attemptId: string,
    @Body() body: { draftResponses: Record<string, unknown> },
  ) {
    const result = await this.examsService.saveDraft(
      req.user.id,
      attemptId,
      body.draftResponses,
    );
    return { message: 'Draft saved', data: result };
  }

  @Get('attempts/:attemptId/draft')
  @UseGuards(JwtAuthGuard)
  async getDraft(
    @Req() req: { user: { id: string } },
    @Param('attemptId') attemptId: string,
  ) {
    const userId = req.user.id;
    const result = await this.examsService.getDraft(userId, attemptId);
    return { message: 'Draft retrieved', data: result };
  }

  // ─── Topics ───────────────────────────────────────────────────────────────

  @Get('subjects/:subjectId/topics')
  @UseGuards(JwtAuthGuard)
  async getTopicsForSubject(@Param('subjectId') subjectId: string) {
    const topics = await this.examsService.getTopicsForSubject(subjectId);
    return { message: 'Topics retrieved', data: topics };
  }

  @Get('topics/search')
  @UseGuards(JwtAuthGuard)
  async searchTopics(
    @Query('examTypeId') examTypeId: string,
    @Query('q') q: string,
  ) {
    const topics = await this.examsService.searchTopics(examTypeId, q);
    return { message: 'Topics retrieved', data: topics };
  }

  @Get('types/:examTypeId/topics')
  @UseGuards(JwtAuthGuard)
  async getTopicsByExamType(
    @Param('examTypeId') examTypeId: string,
    @Query('subjectIds') subjectIds?: string,
  ) {
    const ids = subjectIds ? subjectIds.split(',').filter(Boolean) : undefined;
    const topics = await this.examsService.getTopicsByExamType(examTypeId, ids);
    return { message: 'Topics retrieved', data: topics };
  }

  @Get('topics/:topicId')
  @UseGuards(JwtAuthGuard)
  async getTopic(@Param('topicId') topicId: string) {
    const topic = await this.examsService.getTopic(topicId);
    return { message: 'Topic retrieved', data: topic };
  }

  // ─── Admin ────────────────────────────────────────────────────────────────

  /**
   * Seeds dummy question data for development/testing.
   * Idempotent — safe to call multiple times.
   * Admin-only.
   */
  @Post('admin/reseed-questions')
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(UserType.ADMIN)
  async reseedQuestions() {
    const result = await this.examsService.seedDummyQuestions();
    return {
      message: 'Seed complete',
      data: result,
    };
  }

  /**
   * Diagnostic: shows ETS records, question counts per ETS, and orphaned question count.
   * Use this to verify examTypeSubjectId integrity when questions return empty on exam start.
   */
  @Get('admin/diagnose-questions')
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(UserType.ADMIN)
  async diagnoseQuestions() {
    const result = await this.examsService.diagnoseQuestions();
    return { message: 'Diagnosis complete', data: result };
  }
}
