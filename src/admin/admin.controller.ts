import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Header,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { AdminJwtGuard } from './guards/admin-jwt.guard';
import { AdminAccessGuard } from './guards/admin-access.guard';
import { AdminAccess } from './decorators/admin-access.decorator';
import {
  AdminModule,
  ModulePermissionsMap,
} from './entities/admin-role.entity';
import { AdminService } from './admin.service';
import { AdminExamRevisionService } from './admin-exam-revision.service';
import { AdminUsersService } from './admin-users.service';
import { AdminSubscriptionsService } from './admin-subscriptions.service';
import { AdminTestimonialsService } from './admin-testimonials.service';
import type { TestimonialDto } from './admin-testimonials.service';
import {
  AdminBulkEmailsService,
  CampaignDto,
} from './admin-bulk-emails.service';
import { AdminMessagesService } from './admin-messages.service';
import { AdminAnalyticsService } from './admin-analytics.service';
import { SubscriptionStatus } from '../../types';
import { FlagStatus } from '../chats/entities/message-flag.entity';
import { CampaignTargetAudience } from './entities/bulk-email-campaign.entity';

// ─── Auth (no guard) ───────────────────────────────────────────────────────────

@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly adminService: AdminService) {}

  @Post('login')
  login(@Body() body: { email: string; password: string }) {
    return this.adminService.login(body.email, body.password);
  }

  @Post('accept-invite')
  acceptInvite(@Body() body: { token: string; password: string }) {
    return this.adminService.acceptInvite(body.token, body.password);
  }
}

// ─── Admin management ─────────────────────────────────────────────────────────

@Controller('admin/management')
@UseGuards(AdminJwtGuard, AdminAccessGuard)
export class AdminManagementController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  @AdminAccess(AdminModule.ADMIN_MANAGEMENT, 'read')
  listAdmins(@Query('page') page = '1', @Query('limit') limit = '20') {
    return this.adminService.listAdmins(Number(page), Number(limit));
  }

  @Post('invite')
  @AdminAccess(AdminModule.ADMIN_MANAGEMENT, 'write')
  sendInvite(
    @Request() req: { user: { sub: string } },
    @Body()
    body: {
      email: string;
      firstName: string;
      lastName: string;
      roleId?: string | null;
      modulePermissions: ModulePermissionsMap;
    },
  ) {
    return this.adminService.sendInvite(
      req.user.sub,
      body.email,
      body.firstName,
      body.lastName,
      body.roleId ?? null,
      body.modulePermissions ?? {},
    );
  }

  @Patch(':id/permissions')
  @AdminAccess(AdminModule.ADMIN_MANAGEMENT, 'write')
  updatePermissions(
    @Request() req: { user: { sub: string } },
    @Param('id') id: string,
    @Body() body: { modulePermissions: ModulePermissionsMap },
  ) {
    return this.adminService.updatePermissions(
      id,
      req.user.sub,
      body.modulePermissions,
    );
  }

  @Patch(':id/deactivate')
  @AdminAccess(AdminModule.ADMIN_MANAGEMENT, 'write')
  deactivateAdmin(@Param('id') id: string) {
    return this.adminService.deactivateAdmin(id);
  }

  @Patch(':id/reactivate')
  @AdminAccess(AdminModule.ADMIN_MANAGEMENT, 'write')
  reactivateAdmin(@Param('id') id: string) {
    return this.adminService.reactivateAdmin(id);
  }
}

// ─── Role templates ───────────────────────────────────────────────────────────

@Controller('admin/roles')
@UseGuards(AdminJwtGuard, AdminAccessGuard)
export class AdminRolesController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  @AdminAccess(AdminModule.ADMIN_MANAGEMENT, 'read')
  listRoles(
    @Query('page') page = '1',
    @Query('limit') limit = '50',
    @Query('search') search?: string,
  ) {
    return this.adminService.listRoles(Number(page), Number(limit), search);
  }

  @Post()
  @AdminAccess(AdminModule.ADMIN_MANAGEMENT, 'write')
  createRole(
    @Request() req: { user: { sub: string } },
    @Body()
    body: {
      name: string;
      description?: string | null;
      modules: ModulePermissionsMap;
    },
  ) {
    return this.adminService.createRole(
      body.name,
      body.description ?? null,
      body.modules,
      req.user.sub,
    );
  }

  @Patch(':id')
  @AdminAccess(AdminModule.ADMIN_MANAGEMENT, 'write')
  updateRole(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      description?: string | null;
      modules?: ModulePermissionsMap;
    },
  ) {
    return this.adminService.updateRole(
      id,
      body.name,
      body.description,
      body.modules,
    );
  }

  @Delete(':id')
  @AdminAccess(AdminModule.ADMIN_MANAGEMENT, 'write')
  deleteRole(@Param('id') id: string) {
    return this.adminService.deleteRole(id);
  }
}

// ─── Exam Revision ────────────────────────────────────────────────────────────

@Controller('admin/exam-revision')
@UseGuards(AdminJwtGuard, AdminAccessGuard)
export class AdminExamRevisionController {
  constructor(private readonly examRevision: AdminExamRevisionService) {}

  // ExamTypes
  @Get('exam-types')
  @AdminAccess(AdminModule.EXAM_REVISION, 'read')
  listExamTypes(
    @Query('page') page = '1',
    @Query('limit') limit = '50',
    @Query('search') search?: string,
  ) {
    return this.examRevision.listExamTypes({
      page: Number(page),
      limit: Number(limit),
      search,
    });
  }

  @Post('exam-types')
  @AdminAccess(AdminModule.EXAM_REVISION, 'write')
  createExamType(
    @Body()
    body: {
      name: string;
      description?: string;
      minSubjectsSelectable: number;
      maxSubjectsSelectable: number;
      freeTierQuestionLimit?: number;
      supportedCategories: string[];
    },
  ) {
    return this.examRevision.createExamType(body);
  }

  @Patch('exam-types/:id')
  @AdminAccess(AdminModule.EXAM_REVISION, 'write')
  updateExamType(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.examRevision.updateExamType(
      id,
      body as Parameters<AdminExamRevisionService['updateExamType']>[1],
    );
  }

  @Delete('exam-types/:id')
  @AdminAccess(AdminModule.EXAM_REVISION, 'write')
  deleteExamType(@Param('id') id: string) {
    return this.examRevision.deleteExamType(id);
  }

  // Subjects
  @Get('subjects')
  @AdminAccess(AdminModule.EXAM_REVISION, 'read')
  listSubjects(
    @Query('page') page = '1',
    @Query('limit') limit = '50',
    @Query('search') search?: string,
  ) {
    return this.examRevision.listSubjects({
      page: Number(page),
      limit: Number(limit),
      search,
    });
  }

  @Post('subjects')
  @AdminAccess(AdminModule.EXAM_REVISION, 'write')
  createSubject(
    @Body() body: { name: string; description?: string; isActive?: boolean },
  ) {
    return this.examRevision.createSubject(body);
  }

  @Patch('subjects/:id')
  @AdminAccess(AdminModule.EXAM_REVISION, 'write')
  updateSubject(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.examRevision.updateSubject(
      id,
      body as Parameters<AdminExamRevisionService['updateSubject']>[1],
    );
  }

  @Delete('subjects/:id')
  @AdminAccess(AdminModule.EXAM_REVISION, 'write')
  deleteSubject(@Param('id') id: string) {
    return this.examRevision.deleteSubject(id);
  }

  // ExamTypeSubjects (linking)
  @Get('ets')
  @AdminAccess(AdminModule.EXAM_REVISION, 'read')
  listAllEts(
    @Query('page') page = '1',
    @Query('limit') limit = '50',
    @Query('search') search?: string,
    @Query('examTypeId') examTypeId?: string,
    @Query('subjectId') subjectId?: string,
  ) {
    return this.examRevision.listAllEts({
      page: Number(page),
      limit: Number(limit),
      search,
      examTypeId,
      subjectId,
    });
  }

  @Get('exam-type-subjects')
  @AdminAccess(AdminModule.EXAM_REVISION, 'read')
  listExamTypeSubjects(@Query('examTypeId') examTypeId?: string) {
    return this.examRevision.listExamTypeSubjects(examTypeId);
  }

  @Post('exam-type-subjects')
  @AdminAccess(AdminModule.EXAM_REVISION, 'write')
  linkExamTypeSubject(
    @Body()
    body: {
      examTypeId: string;
      subjectId: string;
      isCompulsory?: boolean;
    },
  ) {
    return this.examRevision.linkExamTypeSubject(
      body.examTypeId,
      body.subjectId,
      body.isCompulsory,
    );
  }

  @Patch('exam-type-subjects/:id')
  @AdminAccess(AdminModule.EXAM_REVISION, 'write')
  updateExamTypeSubject(
    @Param('id') id: string,
    @Body() body: { isCompulsory: boolean },
  ) {
    return this.examRevision.updateExamTypeSubject(id, body);
  }

  @Delete('exam-type-subjects/:id')
  @AdminAccess(AdminModule.EXAM_REVISION, 'write')
  unlinkExamTypeSubject(@Param('id') id: string) {
    return this.examRevision.unlinkExamTypeSubject(id);
  }

  // Topics
  @Get('topics')
  @AdminAccess(AdminModule.EXAM_REVISION, 'read')
  listTopics(
    @Query('page') page = '1',
    @Query('limit') limit = '50',
    @Query('subjectId') subjectId?: string,
    @Query('search') search?: string,
  ) {
    return this.examRevision.listTopics({
      page: Number(page),
      limit: Number(limit),
      subjectId,
      search,
    });
  }

  @Post('topics')
  @AdminAccess(AdminModule.EXAM_REVISION, 'write')
  createTopic(
    @Body() body: { subjectId: string; name: string; content?: string },
  ) {
    return this.examRevision.createTopic(body);
  }

  @Patch('topics/:id')
  @AdminAccess(AdminModule.EXAM_REVISION, 'write')
  updateTopic(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.examRevision.updateTopic(
      id,
      body as Parameters<AdminExamRevisionService['updateTopic']>[1],
    );
  }

  @Delete('topics/:id')
  @AdminAccess(AdminModule.EXAM_REVISION, 'write')
  deleteTopic(@Param('id') id: string) {
    return this.examRevision.deleteTopic(id);
  }

  // Passages
  @Get('passages')
  @AdminAccess(AdminModule.EXAM_REVISION, 'read')
  listPassages(
    @Query('page') page = '1',
    @Query('limit') limit = '50',
    @Query('examTypeSubjectId') examTypeSubjectId?: string,
    @Query('search') search?: string,
  ) {
    return this.examRevision.listPassages({
      page: Number(page),
      limit: Number(limit),
      examTypeSubjectId,
      search,
    });
  }

  @Post('passages')
  @AdminAccess(AdminModule.EXAM_REVISION, 'write')
  createPassage(
    @Body() body: { examTypeSubjectId: string; title: string; content: string },
  ) {
    return this.examRevision.createPassage(body);
  }

  @Patch('passages/:id')
  @AdminAccess(AdminModule.EXAM_REVISION, 'write')
  updatePassage(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.examRevision.updatePassage(
      id,
      body as Parameters<AdminExamRevisionService['updatePassage']>[1],
    );
  }

  @Delete('passages/:id')
  @AdminAccess(AdminModule.EXAM_REVISION, 'write')
  deletePassage(@Param('id') id: string) {
    return this.examRevision.deletePassage(id);
  }

  // Questions
  @Get('questions')
  @AdminAccess(AdminModule.EXAM_REVISION, 'read')
  listQuestions(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('examTypeSubjectId') examTypeSubjectId?: string,
    @Query('type') type?: string,
    @Query('category') category?: string,
    @Query('difficulty') difficulty?: string,
    @Query('search') search?: string,
  ) {
    return this.examRevision.listQuestions({
      page: Number(page),
      limit: Number(limit),
      examTypeSubjectId,
      type,
      category,
      difficulty,
      search,
    });
  }

  @Get('questions/:id')
  @AdminAccess(AdminModule.EXAM_REVISION, 'read')
  getQuestion(@Param('id') id: string) {
    return this.examRevision.getQuestion(id);
  }

  @Post('questions')
  @AdminAccess(AdminModule.EXAM_REVISION, 'write')
  createQuestion(
    @Body() body: Parameters<AdminExamRevisionService['createQuestion']>[0],
  ) {
    return this.examRevision.createQuestion(body);
  }

  @Patch('questions/:id')
  @AdminAccess(AdminModule.EXAM_REVISION, 'write')
  updateQuestion(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.examRevision.updateQuestion(
      id,
      body as Parameters<AdminExamRevisionService['updateQuestion']>[1],
    );
  }

  @Delete('questions/:id')
  @AdminAccess(AdminModule.EXAM_REVISION, 'write')
  deleteQuestion(@Param('id') id: string) {
    return this.examRevision.deleteQuestion(id);
  }

  @Post('questions/bulk-import')
  @AdminAccess(AdminModule.EXAM_REVISION, 'write')
  bulkImport(@Body() body: { questions: Array<Record<string, unknown>> }) {
    return this.examRevision.bulkImportQuestions(body.questions);
  }

  @Get('questions/csv-template')
  @AdminAccess(AdminModule.EXAM_REVISION, 'read')
  @Header('Content-Type', 'text/csv')
  @Header(
    'Content-Disposition',
    'attachment; filename="questions-template.csv"',
  )
  getCsvTemplate(@Res() res: Response) {
    res.send(this.examRevision.getQuestionCsvTemplate());
  }
}

// ─── Students ─────────────────────────────────────────────────────────────────

@Controller('admin/students')
@UseGuards(AdminJwtGuard, AdminAccessGuard)
export class AdminStudentsController {
  constructor(private readonly usersService: AdminUsersService) {}

  @Get()
  @AdminAccess(AdminModule.STUDENTS, 'read')
  list(
    @Query('limit') limit = '50',
    @Query('search') search?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.usersService.listStudents(Number(limit), search, cursor);
  }

  @Patch(':userId/reset-password')
  @AdminAccess(AdminModule.STUDENTS, 'write')
  resetPassword(@Param('userId') userId: string) {
    return this.usersService.resetStudentPassword(userId);
  }

  @Patch(':userId/deactivate')
  @AdminAccess(AdminModule.STUDENTS, 'write')
  deactivate(@Param('userId') userId: string) {
    return this.usersService.deactivateStudent(userId);
  }

  @Patch(':userId/reactivate')
  @AdminAccess(AdminModule.STUDENTS, 'write')
  reactivate(@Param('userId') userId: string) {
    return this.usersService.reactivateStudent(userId);
  }

  @Patch(':userId/suspend')
  @AdminAccess(AdminModule.STUDENTS, 'write')
  suspend(
    @Param('userId') userId: string,
    @Body() body: { suspendedUntil: string },
  ) {
    return this.usersService.suspendStudent(
      userId,
      new Date(body.suspendedUntil),
    );
  }

  @Patch(':userId/unsuspend')
  @AdminAccess(AdminModule.STUDENTS, 'write')
  unsuspend(@Param('userId') userId: string) {
    return this.usersService.unsuspendStudent(userId);
  }
}

// ─── Sponsors ─────────────────────────────────────────────────────────────────

@Controller('admin/sponsors')
@UseGuards(AdminJwtGuard, AdminAccessGuard)
export class AdminSponsorsController {
  constructor(private readonly usersService: AdminUsersService) {}

  @Get()
  @AdminAccess(AdminModule.SPONSORS, 'read')
  list(
    @Query('limit') limit = '50',
    @Query('search') search?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.usersService.listSponsors(Number(limit), search, cursor);
  }

  @Patch(':userId/send-reset-link')
  @AdminAccess(AdminModule.SPONSORS, 'write')
  sendResetLink(@Param('userId') userId: string) {
    return this.usersService.sendSponsorPasswordReset(userId);
  }

  @Patch(':userId/deactivate')
  @AdminAccess(AdminModule.SPONSORS, 'write')
  deactivate(@Param('userId') userId: string) {
    return this.usersService.deactivateSponsor(userId);
  }

  @Patch(':userId/reactivate')
  @AdminAccess(AdminModule.SPONSORS, 'write')
  reactivate(@Param('userId') userId: string) {
    return this.usersService.reactivateSponsor(userId);
  }
}

// ─── Affiliates ───────────────────────────────────────────────────────────────

@Controller('admin/affiliates')
@UseGuards(AdminJwtGuard, AdminAccessGuard)
export class AdminAffiliatesController {
  constructor(private readonly usersService: AdminUsersService) {}

  @Get()
  @AdminAccess(AdminModule.AFFILIATES, 'read')
  list(
    @Query('limit') limit = '50',
    @Query('search') search?: string,
    @Query('cursor') cursor?: string,
    @Query('userType') userType?: string,
  ) {
    return this.usersService.listAffiliates(Number(limit), search, cursor, userType);
  }

  @Patch(':userId/deactivate')
  @AdminAccess(AdminModule.AFFILIATES, 'write')
  deactivate(@Param('userId') userId: string) {
    return this.usersService.deactivateAffiliate(userId);
  }

  @Patch(':userId/reactivate')
  @AdminAccess(AdminModule.AFFILIATES, 'write')
  reactivate(@Param('userId') userId: string) {
    return this.usersService.reactivateAffiliate(userId);
  }

  @Get('payouts')
  @AdminAccess(AdminModule.AFFILIATES, 'read')
  listAllPayouts(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('status') status?: string,
  ) {
    return this.usersService.listAllPayouts(
      Number(page),
      Number(limit),
      status,
    );
  }

  @Get(':affiliateId/payouts')
  @AdminAccess(AdminModule.AFFILIATES, 'read')
  listPayouts(
    @Param('affiliateId') affiliateId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.usersService.listPayouts(
      affiliateId,
      Number(page),
      Number(limit),
    );
  }

  @Patch('payouts/:payoutId/approve')
  @AdminAccess(AdminModule.AFFILIATES, 'write')
  approvePayout(@Param('payoutId') payoutId: string) {
    return this.usersService.approvePayout(payoutId);
  }

  @Patch('payouts/:payoutId/reject')
  @AdminAccess(AdminModule.AFFILIATES, 'write')
  rejectPayout(
    @Param('payoutId') payoutId: string,
    @Body() body: { reason: string },
  ) {
    return this.usersService.rejectPayout(payoutId, body.reason);
  }
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

@Controller('admin/subscriptions')
@UseGuards(AdminJwtGuard, AdminAccessGuard)
export class AdminSubscriptionsController {
  constructor(
    private readonly subscriptionsService: AdminSubscriptionsService,
  ) {}

  @Get()
  @AdminAccess(AdminModule.SUBSCRIPTIONS, 'read')
  list(
    @Query('limit') limit = '50',
    @Query('cursor') cursor?: string,
    @Query('type') type?: 'student' | 'sponsor',
    @Query('status') status?: string,
    @Query('examTypeId') examTypeId?: string,
    @Query('search') search?: string,
  ) {
    return this.subscriptionsService.listSubscriptions({
      limit: Number(limit),
      cursor,
      type,
      status,
      examTypeId,
      search,
    });
  }

  @Patch(':id/status')
  @AdminAccess(AdminModule.SUBSCRIPTIONS, 'write')
  overrideStatus(
    @Param('id') id: string,
    @Body() body: { status: SubscriptionStatus; endDate?: string },
  ) {
    return this.subscriptionsService.overrideStatus(
      id,
      body.status,
      body.endDate ? new Date(body.endDate) : undefined,
    );
  }

  @Patch(':id/cancel')
  @AdminAccess(AdminModule.SUBSCRIPTIONS, 'write')
  cancel(@Param('id') id: string) {
    return this.subscriptionsService.cancelSubscription(id);
  }

  @Get('plans')
  @AdminAccess(AdminModule.SUBSCRIPTIONS, 'read')
  listPlans() {
    return this.subscriptionsService.listPlans();
  }

  @Post('plans')
  @AdminAccess(AdminModule.SUBSCRIPTIONS, 'write')
  createPlan(
    @Body()
    body: {
      examTypeId: string;
      name: string;
      description?: string;
      durationDays: number;
      sortOrder?: number;
      stripeProductId?: string;
      prices?: Array<{
        currency: string;
        amount: number;
        stripePriceId?: string;
        paystackPlanCode?: string;
      }>;
    },
  ) {
    return this.subscriptionsService.createPlan(body);
  }

  @Patch('plans/:id')
  @AdminAccess(AdminModule.SUBSCRIPTIONS, 'write')
  updatePlan(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      description?: string;
      durationDays?: number;
      sortOrder?: number;
      stripeProductId?: string;
      isActive?: boolean;
      prices?: Array<{
        currency: string;
        amount: number;
        stripePriceId?: string;
        paystackPlanCode?: string;
      }>;
    },
  ) {
    return this.subscriptionsService.updatePlan(id, body);
  }

  @Delete('plans/:id')
  @AdminAccess(AdminModule.SUBSCRIPTIONS, 'write')
  deletePlan(@Param('id') id: string) {
    return this.subscriptionsService.deletePlan(id);
  }

  @Get('region-currencies')
  @AdminAccess(AdminModule.SUBSCRIPTIONS, 'read')
  listRegionCurrencies(
    @Query('page') page = '1',
    @Query('limit') limit = '50',
    @Query('search') search?: string,
  ) {
    return this.subscriptionsService.listRegionCurrencies({
      page: Number(page),
      limit: Number(limit),
      search,
    });
  }

  @Post('region-currencies')
  @AdminAccess(AdminModule.SUBSCRIPTIONS, 'write')
  createRegionCurrency(
    @Body()
    body: {
      regionCode: string;
      regionName: string;
      currency: string;
      paymentProvider: string;
      isActive?: boolean;
    },
  ) {
    return this.subscriptionsService.createRegionCurrency(body);
  }

  @Patch('region-currencies/:id')
  @AdminAccess(AdminModule.SUBSCRIPTIONS, 'write')
  updateRegionCurrency(
    @Param('id') id: string,
    @Body()
    body: {
      regionName?: string;
      currency?: string;
      paymentProvider?: string;
      isActive?: boolean;
    },
  ) {
    return this.subscriptionsService.updateRegionCurrency(id, body);
  }
}

// ─── Testimonials ─────────────────────────────────────────────────────────────

@Controller('admin/testimonials')
@UseGuards(AdminJwtGuard, AdminAccessGuard)
export class AdminTestimonialsController {
  constructor(private readonly testimonialsService: AdminTestimonialsService) {}

  @Get()
  @AdminAccess(AdminModule.TESTIMONIALS, 'read')
  list() {
    return this.testimonialsService.listTestimonials();
  }

  @Post()
  @AdminAccess(AdminModule.TESTIMONIALS, 'write')
  create(@Body() body: TestimonialDto) {
    return this.testimonialsService.createTestimonial(body);
  }

  @Patch('reorder')
  @AdminAccess(AdminModule.TESTIMONIALS, 'write')
  reorder(@Body() body: { orderedIds: string[] }) {
    return this.testimonialsService.reorder(body.orderedIds);
  }

  @Patch(':id')
  @AdminAccess(AdminModule.TESTIMONIALS, 'write')
  update(@Param('id') id: string, @Body() body: Partial<TestimonialDto>) {
    return this.testimonialsService.updateTestimonial(id, body);
  }

  @Delete(':id')
  @AdminAccess(AdminModule.TESTIMONIALS, 'write')
  delete(@Param('id') id: string) {
    return this.testimonialsService.deleteTestimonial(id);
  }

  @Patch(':id/toggle-publish')
  @AdminAccess(AdminModule.TESTIMONIALS, 'write')
  togglePublish(@Param('id') id: string) {
    return this.testimonialsService.togglePublish(id);
  }
}

// ─── Bulk Emails ──────────────────────────────────────────────────────────────

@Controller('admin/bulk-emails')
@UseGuards(AdminJwtGuard, AdminAccessGuard)
export class AdminBulkEmailsController {
  constructor(private readonly bulkEmailsService: AdminBulkEmailsService) {}

  @Get()
  @AdminAccess(AdminModule.BULK_EMAILS, 'read')
  list(@Query('page') page = '1', @Query('limit') limit = '20') {
    return this.bulkEmailsService.listCampaigns(Number(page), Number(limit));
  }

  @Post()
  @AdminAccess(AdminModule.BULK_EMAILS, 'write')
  create(
    @Request() req: { user: { sub: string } },
    @Body()
    body: {
      name: string;
      subject: string;
      content: string;
      targetAudience: CampaignTargetAudience;
    },
  ) {
    const dto: CampaignDto = {
      name: body.name,
      subject: body.subject,
      content: body.content,
      targetAudience: body.targetAudience,
    };
    return this.bulkEmailsService.createCampaign(dto, req.user.sub);
  }

  @Patch(':id')
  @AdminAccess(AdminModule.BULK_EMAILS, 'write')
  update(
    @Param('id') id: string,
    @Body()
    body: Partial<{
      name: string;
      subject: string;
      content: string;
      targetAudience: CampaignTargetAudience;
    }>,
  ) {
    return this.bulkEmailsService.updateCampaign(id, body);
  }

  @Delete(':id')
  @AdminAccess(AdminModule.BULK_EMAILS, 'write')
  delete(@Param('id') id: string) {
    return this.bulkEmailsService.deleteCampaign(id);
  }

  @Post(':id/send')
  @AdminAccess(AdminModule.BULK_EMAILS, 'write')
  send(@Param('id') id: string) {
    return this.bulkEmailsService.sendCampaign(id);
  }
}

// ─── Messages ─────────────────────────────────────────────────────────────────

@Controller('admin/messages')
@UseGuards(AdminJwtGuard, AdminAccessGuard)
export class AdminMessagesController {
  constructor(private readonly messagesService: AdminMessagesService) {}

  @Get('flags')
  @AdminAccess(AdminModule.MESSAGES, 'read')
  listFlags(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('status') status?: FlagStatus,
  ) {
    return this.messagesService.listFlags(Number(page), Number(limit), status);
  }

  @Patch('flags/:id/review')
  @AdminAccess(AdminModule.MESSAGES, 'write')
  reviewFlag(
    @Request() req: { user: { sub: string } },
    @Param('id') id: string,
    @Body() body: { adminNotes?: string },
  ) {
    return this.messagesService.reviewFlag(id, req.user.sub, body.adminNotes);
  }

  @Patch('flags/:id/dismiss')
  @AdminAccess(AdminModule.MESSAGES, 'write')
  dismissFlag(
    @Request() req: { user: { sub: string } },
    @Param('id') id: string,
    @Body() body: { adminNotes?: string },
  ) {
    return this.messagesService.dismissFlag(id, req.user.sub, body.adminNotes);
  }

  @Patch('users/:userId/suspend')
  @AdminAccess(AdminModule.MESSAGES, 'write')
  suspendUser(
    @Param('userId') userId: string,
    @Body() body: { suspendedUntil: string },
  ) {
    return this.messagesService.suspendUser(
      userId,
      new Date(body.suspendedUntil),
    );
  }
}

// ─── Dashboard analytics ──────────────────────────────────────────────────────

@Controller('admin/dashboard')
@UseGuards(AdminJwtGuard, AdminAccessGuard)
export class AdminDashboardController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  @AdminAccess(AdminModule.ANALYTICS, 'read')
  getPlatformStats() {
    return this.adminService.getPlatformStats();
  }

  @Get('registrations')
  @AdminAccess(AdminModule.ANALYTICS, 'read')
  getRegistrations(
    @Query('granularity') granularity: 'day' | 'week' | 'month' = 'month',
    @Query('timezone') timezone = 'UTC',
  ) {
    return this.adminService.getRegistrationOverTime(granularity, timezone);
  }
}

// ─── Platform analytics ───────────────────────────────────────────────────────

@Controller('admin/analytics')
@UseGuards(AdminJwtGuard, AdminAccessGuard)
export class AdminAnalyticsController {
  constructor(private readonly analyticsService: AdminAnalyticsService) {}

  @Get('kpis')
  @AdminAccess(AdminModule.ANALYTICS, 'read')
  getKpis() {
    return this.analyticsService.getPlatformKpis();
  }

  @Get('exam-completions')
  @AdminAccess(AdminModule.ANALYTICS, 'read')
  getExamCompletions(
    @Query('granularity') granularity: 'day' | 'week' | 'month' = 'day',
    @Query('timezone') timezone = 'UTC',
  ) {
    return this.analyticsService.getExamCompletions(granularity, timezone);
  }

  @Get('subject-performance')
  @AdminAccess(AdminModule.ANALYTICS, 'read')
  getSubjectPerformance() {
    return this.analyticsService.getSubjectPerformance();
  }

  @Get('question-distribution')
  @AdminAccess(AdminModule.ANALYTICS, 'read')
  getQuestionDistribution() {
    return this.analyticsService.getQuestionDistribution();
  }

  @Get('revenue')
  @AdminAccess(AdminModule.ANALYTICS, 'read')
  getRevenue(
    @Query('granularity') granularity: 'day' | 'week' | 'month' = 'day',
    @Query('timezone') timezone = 'UTC',
  ) {
    return this.analyticsService.getRevenueOverTime(granularity, timezone);
  }

  @Get('exam-types')
  @AdminAccess(AdminModule.ANALYTICS, 'read')
  getExamTypeBreakdown() {
    return this.analyticsService.getExamTypeBreakdown();
  }
}
