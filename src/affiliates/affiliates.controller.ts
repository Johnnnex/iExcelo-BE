import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Query,
  Param,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { AffiliatesService } from './affiliates.service';
import { JwtAuthGuard } from '../common/guards/jwt.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { Currency } from '../../types';

@Controller('affiliates')
@UseGuards(JwtAuthGuard)
export class AffiliatesController {
  constructor(private readonly affiliatesService: AffiliatesService) {}

  /**
   * GET /affiliates/dashboard — Profile stats + conversion rate
   * Optional: ?currency=NGN to filter earnings by currency
   */
  @Get('dashboard')
  async getDashboard(
    @CurrentUser() user: User,
    @Query('currency') currency?: Currency,
  ) {
    const dashboard = await this.affiliatesService.getDashboard(
      user.id,
      currency,
    );
    if (!dashboard) {
      throw new NotFoundException('Affiliate profile not found');
    }
    return { message: 'Dashboard retrieved', data: dashboard };
  }

  /**
   * GET /affiliates/referrals — Paginated referrals with user names
   * Optional: ?currency=NGN to filter revenue by currency
   */
  @Get('referrals')
  async getReferrals(
    @CurrentUser() user: User,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
    @Query('currency') currency?: Currency,
  ) {
    const profile = await this.affiliatesService.findByUserId(user.id);
    if (!profile) {
      throw new NotFoundException('Affiliate profile not found');
    }
    const result = await this.affiliatesService.getReferrals(
      profile.id,
      parseInt(page, 10),
      parseInt(limit, 10),
      currency,
    );
    return { message: 'Referrals retrieved', ...result };
  }

  /**
   * GET /affiliates/commissions — Paginated commissions
   * Optional: ?currency=NGN to filter by commission currency
   */
  @Get('commissions')
  async getCommissions(
    @CurrentUser() user: User,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
    @Query('currency') currency?: Currency,
  ) {
    const profile = await this.affiliatesService.findByUserId(user.id);
    if (!profile) {
      throw new NotFoundException('Affiliate profile not found');
    }
    const result = await this.affiliatesService.getCommissions(
      profile.id,
      parseInt(page, 10),
      parseInt(limit, 10),
      currency,
    );
    return { message: 'Commissions retrieved', ...result };
  }

  /**
   * GET /affiliates/earnings-by-plan — Earnings grouped by planName (pie chart)
   * Optional: ?currency=NGN to filter by currency
   */
  @Get('earnings-by-plan')
  async getEarningsByPlan(
    @CurrentUser() user: User,
    @Query('currency') currency?: Currency,
  ) {
    const profile = await this.affiliatesService.findByUserId(user.id);
    if (!profile) {
      throw new NotFoundException('Affiliate profile not found');
    }
    const data = await this.affiliatesService.getEarningsByPlan(
      profile.id,
      currency,
    );
    return { message: 'Earnings by plan retrieved', data };
  }

  /**
   * GET /affiliates/earnings-by-currency — Earnings grouped by currency
   */
  @Get('earnings-by-currency')
  async getEarningsByCurrency(@CurrentUser() user: User) {
    const profile = await this.affiliatesService.findByUserId(user.id);
    if (!profile) {
      throw new NotFoundException('Affiliate profile not found');
    }
    const data = await this.affiliatesService.getEarningsByCurrency(profile.id);
    return { message: 'Earnings by currency retrieved', data };
  }

  /**
   * GET /affiliates/earnings-over-time — Earnings for time range (line chart)
   * Optional: ?currency=NGN to filter by currency
   */
  @Get('earnings-over-time')
  async getEarningsOverTime(
    @CurrentUser() user: User,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('granularity') granularity?: 'day' | 'week' | 'month',
    @Query('currency') currency?: Currency,
    @Query('timezone') timezone?: string,
  ) {
    const profile = await this.affiliatesService.findByUserId(user.id);
    if (!profile) {
      throw new NotFoundException('Affiliate profile not found');
    }

    const start = startDate
      ? new Date(startDate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default: last 30 days
    const end = endDate ? new Date(endDate) : new Date();

    const data = await this.affiliatesService.getEarningsOverTime(
      profile.id,
      start,
      end,
      granularity || 'day',
      currency,
      timezone || 'UTC',
    );
    return { message: 'Earnings over time retrieved', data };
  }

  /**
   * GET /affiliates/payouts — Paginated payout history
   */
  @Get('payouts')
  async getPayouts(
    @CurrentUser() user: User,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
  ) {
    const profile = await this.affiliatesService.findByUserId(user.id);
    if (!profile) {
      throw new NotFoundException('Affiliate profile not found');
    }
    const result = await this.affiliatesService.getPayouts(
      profile.id,
      parseInt(page, 10),
      parseInt(limit, 10),
    );
    return { message: 'Payouts retrieved', ...result };
  }

  /**
   * POST /affiliates/withdraw — Request withdrawal from pending balance
   */
  @Post('withdraw')
  async requestWithdrawal(
    @CurrentUser() user: User,
    @Body('amount') amount: number,
  ) {
    const profile = await this.affiliatesService.findByUserId(user.id);
    if (!profile) {
      throw new NotFoundException('Affiliate profile not found');
    }
    const payout = await this.affiliatesService.requestWithdrawal(
      profile.id,
      amount,
    );
    return { message: 'Withdrawal requested', data: payout };
  }

  /**
   * GET /affiliates/check-code/:code — Check if affiliate code is available
   */
  @Get('check-code/:code')
  async checkCodeAvailability(
    @CurrentUser() user: User,
    @Param('code') code: string,
  ) {
    const profile = await this.affiliatesService.findByUserId(user.id);
    const result = await this.affiliatesService.checkCodeAvailability(
      code,
      profile?.id,
    );
    return { message: 'Code availability checked', data: result };
  }

  /**
   * PATCH /affiliates/code — Change affiliate code (username-style)
   */
  @Patch('code')
  async updateAffiliateCode(
    @CurrentUser() user: User,
    @Body('code') code: string,
  ) {
    const profile = await this.affiliatesService.findByUserId(user.id);
    if (!profile) {
      throw new NotFoundException('Affiliate profile not found');
    }
    const updated = await this.affiliatesService.updateAffiliateCode(
      profile.id,
      code,
    );
    return { message: 'Affiliate code updated', data: updated };
  }
}
