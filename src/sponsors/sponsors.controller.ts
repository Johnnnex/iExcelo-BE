import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SponsorsService } from './sponsors.service';
import { JwtAuthGuard, RolesGuard } from '../common/guards';
import { Roles } from '../common/decorators/roles.decorator';
import { UserType, GivebackStatus } from '../../types';
import type { Request } from 'express';
import type { User } from '../users/entities/user.entity';

@Controller('sponsors')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserType.SPONSOR)
export class SponsorsController {
  constructor(private readonly sponsorsService: SponsorsService) {}

  // ─── Dashboard ────────────────────────────────────────────────────────────

  @Get('dashboard')
  async getDashboard(@Req() req: Request & { user: User }) {
    const data = await this.sponsorsService.getDashboard(req.user.id);
    return { success: true, data };
  }

  // ─── Students ─────────────────────────────────────────────────────────────

  @Get('students')
  async getStudents(
    @Req() req: Request & { user: User },
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const data = await this.sponsorsService.getStudents(
      req.user.id,
      parseInt(page, 10),
      parseInt(limit, 10),
    );
    return { success: true, data };
  }

  @Get('students/stats')
  async getStudentStats(@Req() req: Request & { user: User }) {
    const data = await this.sponsorsService.getStudentStats(req.user.id);
    return { success: true, data };
  }

  @Post('students')
  async addStudent(
    @Req() req: Request & { user: User },
    @Body()
    body: {
      email: string;
      firstName: string;
      lastName: string;
      phoneNumber?: string;
      examTypeId: string;
    },
  ) {
    const result = await this.sponsorsService.addStudentManually(
      req.user.id,
      body,
    );
    return { success: true, message: result.message };
  }

  // ─── Sponsor URLs ─────────────────────────────────────────────────────────

  @Get('urls')
  async getSponsorUrls(@Req() req: Request & { user: User }) {
    const data = await this.sponsorsService.getSponsorUrls(req.user.id);
    return { success: true, data };
  }

  @Post('urls')
  async createSponsorUrl(
    @Req() req: Request & { user: User },
    @Body() body: { label: string; maxUses?: number | null },
  ) {
    const data = await this.sponsorsService.createSponsorUrl(req.user.id, body);
    return { success: true, data };
  }

  @Patch('urls/:id/toggle')
  @HttpCode(HttpStatus.OK)
  async toggleSponsorUrl(
    @Req() req: Request & { user: User },
    @Param('id') urlId: string,
  ) {
    const data = await this.sponsorsService.toggleSponsorUrl(
      req.user.id,
      urlId,
    );
    return { success: true, data };
  }

  // ─── Student Analytics (sponsor POV) ──────────────────────────────────────

  @Get('students/:studentId/dashboard')
  async getStudentDashboard(
    @Req() req: Request & { user: User },
    @Param('studentId') studentId: string,
    @Query('examTypeId') examTypeId?: string,
    @Query('granularity') granularity?: string,
    @Query('timezone') timezone?: string,
  ) {
    const g = (
      ['day', 'week', 'month'].includes(granularity ?? '')
        ? granularity
        : 'month'
    ) as 'day' | 'week' | 'month';
    const data = await this.sponsorsService.getStudentDashboard(
      req.user.id,
      studentId,
      examTypeId,
      g,
      timezone || 'UTC',
    );
    return { success: true, data };
  }

  @Get('students/:studentId/analytics/subject-scores')
  async getStudentAnalyticsSubjectScores(
    @Req() req: Request & { user: User },
    @Param('studentId') studentId: string,
    @Query('examTypeId') examTypeId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const data = await this.sponsorsService.getStudentAnalyticsSubjectScores(
      req.user.id,
      studentId,
      examTypeId,
      startDate,
      endDate,
    );
    return { success: true, data };
  }

  @Get('students/:studentId/analytics/progress')
  async getStudentAnalyticsProgress(
    @Req() req: Request & { user: User },
    @Param('studentId') studentId: string,
    @Query('examTypeId') examTypeId: string,
    @Query('granularity') granularity?: string,
    @Query('timezone') timezone?: string,
  ) {
    const g = (
      ['day', 'week', 'month'].includes(granularity ?? '')
        ? granularity
        : 'month'
    ) as 'day' | 'week' | 'month';
    const data = await this.sponsorsService.getStudentAnalyticsProgress(
      req.user.id,
      studentId,
      examTypeId,
      g,
      timezone || 'UTC',
    );
    return { success: true, data };
  }

  @Get('students/:studentId/analytics/question-distribution')
  async getStudentAnalyticsQuestionDistribution(
    @Req() req: Request & { user: User },
    @Param('studentId') studentId: string,
    @Query('examTypeId') examTypeId: string,
  ) {
    const data =
      await this.sponsorsService.getStudentAnalyticsQuestionDistribution(
        req.user.id,
        studentId,
        examTypeId,
      );
    return { success: true, data };
  }

  @Get('students/:studentId/analytics/ranking')
  async getStudentAnalyticsRanking(
    @Req() req: Request & { user: User },
    @Param('studentId') studentId: string,
    @Query('examTypeId') examTypeId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const data = await this.sponsorsService.getStudentAnalyticsRanking(
      req.user.id,
      studentId,
      examTypeId,
      startDate,
      endDate,
    );
    return { success: true, data };
  }

  @Get('students/:studentId/analytics/subject-attempts')
  async getStudentAnalyticsSubjectAttempts(
    @Req() req: Request & { user: User },
    @Param('studentId') studentId: string,
    @Query('examTypeId') examTypeId: string,
    @Query('granularity') granularity?: string,
    @Query('date') date?: string,
    @Query('timezone') timezone?: string,
  ) {
    const g = (
      ['day', 'week', 'month'].includes(granularity ?? '')
        ? granularity
        : 'month'
    ) as 'day' | 'week' | 'month';
    const data = await this.sponsorsService.getStudentAnalyticsSubjectAttempts(
      req.user.id,
      studentId,
      examTypeId,
      g,
      date,
      timezone || 'UTC',
    );
    return { success: true, data };
  }

  // ─── Givebacks ────────────────────────────────────────────────────────────

  @Get('givebacks/stats')
  async getGivebackStats(@Req() req: Request & { user: User }) {
    const data = await this.sponsorsService.getGivebackPageStats(req.user.id);
    return { success: true, data };
  }

  @Get('givebacks')
  async getGivebacks(
    @Req() req: Request & { user: User },
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('status') status?: string,
  ) {
    const data = await this.sponsorsService.getGivebacks(
      req.user.id,
      parseInt(page, 10),
      parseInt(limit, 10),
      status as GivebackStatus | undefined,
    );
    return { success: true, data };
  }

  @Post('givebacks/initiate')
  @HttpCode(HttpStatus.OK)
  async initiateGiveback(
    @Req() req: Request & { user: User },
    @Body()
    body: {
      studentIds: string[];
      examTypeId: string;
      planId: string;
      planPriceId: string;
      customerEmail: string;
      callbackUrl: string;
    },
  ) {
    const data = await this.sponsorsService.initiateSponsorSubscriptionGiveback(
      req.user.id,
      body,
    );
    return { success: true, data };
  }

  @Post('givebacks/verify')
  @HttpCode(HttpStatus.OK)
  async verifyGiveback(
    @Req() req: Request & { user: User },
    @Body() body: { reference: string },
  ) {
    const data = await this.sponsorsService.verifySponsorGiveback(
      req.user.id,
      body.reference,
    );
    return { success: true, data };
  }

  @Get('givebacks/expiring')
  async getExpiringSoonGivebacks(@Req() req: Request & { user: User }) {
    const data = await this.sponsorsService.getExpiringSoonGivebacks(
      req.user.id,
    );
    return { success: true, data };
  }

  @Get('givebacks/:id')
  async getGivebackDetail(
    @Req() req: Request & { user: User },
    @Param('id') givebackId: string,
  ) {
    const data = await this.sponsorsService.getGivebackDetail(
      req.user.id,
      givebackId,
    );
    return { success: true, data };
  }

  @Post('givebacks/:id/resub')
  @HttpCode(HttpStatus.OK)
  async initiateResub(
    @Req() req: Request & { user: User },
    @Param('id') originalGivebackId: string,
    @Body()
    body: {
      studentIds: string[];
      examTypeId: string;
      planId: string;
      planPriceId: string;
      customerEmail: string;
      callbackUrl: string;
    },
  ) {
    const data = await this.sponsorsService.initiateResubGiveback(req.user.id, {
      originalGivebackId,
      ...body,
    });
    return { success: true, data };
  }
}
