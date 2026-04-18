/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import {
  Controller,
  Get,
  Post,
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
      user: User & { _isNewUser?: boolean; _needsOnboarding?: boolean };
    },
    @Res() res: Response,
  ) {
    const frontendUrl = this.configService.get('FRONTEND_URL');

    // Check if user needs onboarding (new user or no profile)
    if (req.user._needsOnboarding) {
      // Get existing onboarding token (created during signup, won't send email again)
      const onboardingToken = await this.authService.getOrCreateOnboardingToken(
        req.user.id,
        req.user.email,
      );
      // Redirect to onboarding with the token
      res.redirect(`${frontendUrl}/auth/onboarding?token=${onboardingToken}`);
    } else {
      // Existing user with profile - generate exchange token for callback
      const exchangeToken = this.authService.generateExchangeToken(req.user.id);
      res.redirect(`${frontendUrl}/auth/callback?token=${exchangeToken}`);
    }
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
