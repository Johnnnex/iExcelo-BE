/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  JwtAuthGuard,
  LocalAuthGuard,
  GoogleAuthGuard,
} from '../common/guards';
import { ConfigService } from '@nestjs/config';
import { Public } from '../common/decorators/public.decorator';
import type { Request, Response } from 'express';
import { User } from '../users/entities/user.entity';
import {
  SignUpDto,
  VerifyEmailDto,
  CompleteOnboardingDto,
  ExchangeTokenDto,
  RefreshTokenDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ActivateSponsoredAccountDto,
} from './dto/create-auth.dto';
import {
  UpdateProfileDto,
  ChangePasswordDto,
  UpdateNotificationPrefsDto,
} from './dto/settings.dto';
import { Param } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

@Throttle({ default: { limit: 10, ttl: 60000 } })
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private configService: ConfigService,
  ) {}

  // ========== Local Auth ==========

  @Public()
  @Post('signup')
  async signup(@Body() body: SignUpDto) {
    const result = await this.authService.register(body);

    return {
      success: true,
      message:
        'Registration successful! Please check your email for the verification code.',
      data: { userId: result.userId },
    };
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() body: VerifyEmailDto) {
    const result = await this.authService.verifyEmail(body.email, body.code);

    return {
      success: true,
      message: result.message,
    };
  }

  @Public()
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  async resendVerification(@Body() body: { email: string }) {
    await this.authService.resendVerificationCode(body.email);

    return {
      success: true,
      message:
        'Verification code resent successfully. Please check your email.',
    };
  }

  @Public()
  @Post('login')
  @UseGuards(LocalAuthGuard)
  @HttpCode(HttpStatus.OK)
  async login(@Req() req: Request & { user: User }) {
    // req.user is populated by LocalStrategy
    const result = await this.authService.loginUser(
      req.user,
      req.headers['user-agent'],
      req.ip,
    );

    return {
      success: true,
      message: 'Login successful',
      data: result,
    };
  }

  // ========== Google OAuth ==========

  @Public()
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  async googleAuth() {
    // Initiates Google OAuth flow
  }

  @Public()
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleAuthRedirect(
    @Req()
    req: Request & {
      user: User & {
        _isNewUser?: boolean;
        _needsOnboarding?: boolean;
        _connectResult?: { message: string };
        _connectUserId?: string;
      };
    },
    @Res() res: Response,
  ) {
    const frontendUrl = this.configService.get('FRONTEND_URL');

    // Connect flow — linked successfully, redirect back to security settings
    if (req.user._connectResult) {
      return res.redirect(
        `${frontendUrl}/student/settings/password?connected=true`,
      );
    }

    // Login / signup flow
    if (req.user._needsOnboarding) {
      const onboardingToken = await this.authService.getOrCreateOnboardingToken(
        req.user.id,
        req.user.email,
      );
      return res.redirect(
        `${frontendUrl}/auth/onboarding?token=${onboardingToken}`,
      );
    }

    const exchangeToken = this.authService.generateExchangeToken(req.user.id);
    return res.redirect(`${frontendUrl}/auth/callback?token=${exchangeToken}`);
  }

  @Public()
  @Post('exchange')
  @HttpCode(HttpStatus.OK)
  async exchangeToken(@Body() body: ExchangeTokenDto, @Req() req: Request) {
    const result = await this.authService.exchangeToken(
      body.token,
      req.headers['user-agent'],
      req.ip,
    );

    return {
      success: true,
      message: 'Token exchange successful',
      data: result,
    };
  }

  @Public()
  @Post('onboarding/complete')
  @HttpCode(HttpStatus.OK)
  async completeOnboarding(
    @Body() body: CompleteOnboardingDto,
    @Req() req: Request,
  ) {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Missing or invalid Authorization header',
      );
    }

    const token = authHeader.substring(7);

    const result = await this.authService.completeOnboarding(
      token,
      body,
      req.headers['user-agent'],
      req.ip,
    );

    return {
      success: true,
      message: 'Onboarding completed successfully',
      data: result,
    };
  }

  // ========== Token Management ==========

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() body: RefreshTokenDto, @Req() req: Request) {
    const tokens = await this.authService.refreshTokens(
      body.refreshToken,
      req.headers['user-agent'],
      req.ip,
    );

    return {
      success: true,
      message: 'Tokens refreshed successfully',
      data: tokens,
    };
  }

  // ========== Logout ==========

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request & { user: User & { refreshTokenId: string } },
  ) {
    // req.user.refreshTokenId is attached by JwtAuthGuard
    await this.authService.logout(req.user.refreshTokenId);

    return {
      success: true,
      message: 'Logged out successfully',
    };
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logoutAll(@Req() req: Request & { user: User & { userId: string } }) {
    await this.authService.logoutAll(req.user.userId);

    return {
      success: true,
      message: 'Logged out from all devices',
    };
  }

  // ========== User Info ==========

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getProfile(@Req() req: Request & { user: User }) {
    // req.user contains { userId, email, role, refreshTokenId }
    return {
      success: true,
      data: req.user,
    };
  }

  // ========== Password Reset ==========

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() body: ForgotPasswordDto) {
    const result = await this.authService.requestPasswordReset(body.email);

    return {
      success: true,
      message: result.message,
    };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() body: ResetPasswordDto) {
    const result = await this.authService.resetPassword(
      body.token,
      body.newPassword,
    );

    return {
      success: true,
      message: result.message,
    };
  }

  // ========== Account Settings ==========

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async updateProfile(
    @Req() req: Request & { user: User & { userId: string } },
    @Body() body: UpdateProfileDto,
  ) {
    const user = await this.authService.updateProfile(req.user.userId, body);
    return {
      success: true,
      message: 'Profile updated successfully',
      data: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phoneNumber: user.phoneNumber,
        countryCode: user.countryCode,
        picture: user.picture,
        provider: user.provider,
        googleId: user.googleId,
        newsletterOptIn: user.newsletterOptIn,
        promotionsOptIn: user.promotionsOptIn,
        productUpdatesOptIn: user.productUpdatesOptIn,
        securityAlertsOptIn: user.securityAlertsOptIn,
      },
    };
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Req() req: Request & { user: User & { userId: string } },
    @Body() body: ChangePasswordDto,
  ) {
    const result = await this.authService.changePassword(
      req.user.userId,
      body.currentPassword,
      body.newPassword,
    );
    return { success: true, message: result.message };
  }

  @Patch('notification-preferences')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async updateNotificationPreferences(
    @Req() req: Request & { user: User & { userId: string } },
    @Body() body: UpdateNotificationPrefsDto,
  ) {
    const user = await this.authService.updateNotificationPreferences(
      req.user.userId,
      body,
    );
    return {
      success: true,
      message: 'Notification preferences updated',
      data: {
        newsletterOptIn: user.newsletterOptIn,
        promotionsOptIn: user.promotionsOptIn,
        productUpdatesOptIn: user.productUpdatesOptIn,
        securityAlertsOptIn: user.securityAlertsOptIn,
      },
    };
  }

  @Delete('google')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async disconnectGoogle(
    @Req() req: Request & { user: User & { userId: string } },
  ) {
    const result = await this.authService.disconnectGoogle(req.user.userId);
    return { success: true, message: result.message };
  }

  @Delete('account')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async deleteAccount(
    @Req() req: Request & { user: User & { userId: string } },
  ) {
    const result = await this.authService.deleteAccount(req.user.userId);
    return { success: true, message: result.message };
  }

  // ========== Set Password (Google-only accounts) ==========

  @Post('set-password/request')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async requestSetPassword(
    @Req() req: Request & { user: User & { userId: string } },
  ) {
    const result = await this.authService.requestSetPassword(req.user.userId);
    return { success: true, message: result.message };
  }

  @Post('set-password/confirm')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async confirmSetPassword(
    @Req() req: Request & { user: User & { userId: string } },
    @Body() body: { code: string; newPassword: string },
  ) {
    if (!body.code || !body.newPassword || body.newPassword.length < 8) {
      throw new UnauthorizedException('Invalid request body');
    }
    const result = await this.authService.confirmSetPassword(
      req.user.userId,
      body.code,
      body.newPassword,
    );
    return { success: true, message: result.message };
  }

  // ========== Sponsored Student Activation ==========

  @Public()
  @Get('validate-sponsor-code/:code')
  async validateSponsorCode(@Param('code') code: string) {
    const result = await this.authService.validateSponsorCode(code);
    return { success: true, data: result };
  }

  @Public()
  @Post('activate-sponsored')
  @HttpCode(HttpStatus.OK)
  async activateSponsored(@Body() body: ActivateSponsoredAccountDto) {
    const result = await this.authService.activateSponsoredAccount(
      body.token,
      body.password,
    );
    return { success: true, message: result.message };
  }
}
