/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { LessThan, Repository } from 'typeorm';
import { RefreshToken } from './entities/refresh-tokens.entity';
import { PasswordResetToken } from './entities/password-reset-tokens.entity';
import { EmailVerificationCode } from './entities/email-verification-codes.entity';
import { OnboardingToken } from './entities/onboarding-token.entity';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { EmailService } from '../email/email.service';
import { EMAILS_QUEUE, EmailJobs } from '../email/queue/email.queue';
import { v7 as uuidv7 } from 'uuid';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import {
  AuthProvider,
  ExchangeTokenPayload,
  TokenPayload,
  UserType,
  ReferredUserType,
} from '../../types';
import { StudentsService } from '../students/students.service';
import { SponsorsService } from '../sponsors/sponsors.service';
import { AffiliatesService } from '../affiliates/affiliates.service';
import { LoggerService } from '../logger/logger.service';
import {
  SponsorType,
  LogActionTypes,
  SponsorInviteStatus,
  LogSeverity,
} from '../../types';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService,
    @InjectQueue(EMAILS_QUEUE) private readonly emailQueue: Queue,
    private studentsService: StudentsService,
    private sponsorsService: SponsorsService,
    private affiliatesService: AffiliatesService,
    private loggerService: LoggerService,
    @InjectRepository(RefreshToken)
    private refreshTokenRepo: Repository<RefreshToken>,
    @InjectRepository(PasswordResetToken)
    private passwordResetTokenRepo: Repository<PasswordResetToken>,
    @InjectRepository(EmailVerificationCode)
    private emailVerificationCodeRepo: Repository<EmailVerificationCode>,
    @InjectRepository(OnboardingToken)
    private onboardingTokenRepo: Repository<OnboardingToken>,
  ) {}

  // Google OAuth - Smart provider handling
  // Always creates user if not exists (unified login/signup flow)
  async findOrCreateGoogleUser(googleUser: any) {
    let user = await this.usersService.findByEmail(googleUser.email as string);
    let isNewUser = false;

    if (!user) {
      // New user - create with Google provider (no profile yet)
      isNewUser = true;
      user = await this.usersService.create({
        googleId: googleUser.googleId,
        email: googleUser.email,
        firstName: googleUser.firstName,
        lastName: googleUser.lastName,
        picture: googleUser.picture,
        provider: AuthProvider.GOOGLE,
        emailVerified: true, // Google emails are verified
        role: null, // Role will be set during onboarding
      });

      // Create onboarding token for new user (email sent automatically)
      await this.createOnboardingToken(user.id, user.email);
    } else {
      // Existing user - check provider
      if (user.provider === AuthProvider.LOCAL) {
        // User started with local, now adding Google -> Upgrade to DUAL
        user.googleId = googleUser.googleId;
        user.provider = AuthProvider.DUAL;
        user.picture = user.picture || googleUser.picture; // Update picture if not set
        await this.usersService.update(user.id, {
          googleId: user.googleId,
          provider: user.provider,
          picture: user.picture,
        });
      } else {
        // Already using Google/DUAL - just update googleId if changed
        if (user.googleId !== googleUser.googleId) {
          user.googleId = googleUser.googleId;
          await this.usersService.update(user.id, { googleId: user.googleId });
        }
      }
    }

    // Check if user has a profile (student/sponsor/affiliate)
    const userWithProfile = await this.usersService.findByIdWithProfile(
      user.id,
    );
    // Note: findByIdWithProfile returns profile in a unified 'profile' field
    const hasProfile = (userWithProfile as any)?.profile;

    return { user, isNewUser, needsOnboarding: isNewUser || !hasProfile };
  }

  // Local login (username/password)
  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.usersService.findByEmail(email);

    // Check if user exists
    if (!user) {
      return null;
    }

    // Check if user can login with password (LOCAL or DUAL only)
    if (user.provider === AuthProvider.GOOGLE) {
      throw new UnauthorizedException(
        'This account uses Google login. Please use "Sign in with Google" or reset your password.',
      );
    }

    // Validate password (for LOCAL or DUAL)
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      void this.loggerService.log({
        userId: user.id,
        action: LogActionTypes.LOGIN,
        description: 'Failed login attempt (invalid password)',
        metadata: { email },
        severity: LogSeverity.WARNING,
      });
      return null;
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is inactive');
    }

    // Check if email is verified (for LOCAL or DUAL users)
    if (!user.emailVerified) {
      // Check if verification code is expired
      const latestCode = await this.emailVerificationCodeRepo.findOne({
        where: { userId: user.id, used: false },
        order: { createdAt: 'DESC' },
      });

      if (!latestCode || latestCode.expiresAt < new Date()) {
        // Code is expired or doesn't exist - resend automatically
        await this.generateAndSendVerificationCode(user.id, user.email);

        await this.loggerService.log({
          userId: user.id,
          action: LogActionTypes.OTHER,
          description: `Auto-resent verification code on login (expired): ${user.email}`,
          metadata: { email: user.email },
        });
      }

      throw new UnauthorizedException('EMAIL_NOT_VERIFIED');
    }

    return user;
  }

  // Register local user (with email verification code)
  async register(signUpDto: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    userType?: UserType;
    phoneNumber?: string;
    countryCode?: string;
    examTypeId?: string;
    sponsorType?: string;
    companyName?: string;
    affiliateCode?: string;
    referralCode?: string;
    sponsorCode?: string; // From sponsor URL signup (/signup/s/:code)
  }) {
    const existingUser = await this.usersService.findByEmail(signUpDto.email);

    if (existingUser) {
      throw new UnauthorizedException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(signUpDto.password, 10);
    const finalUserType = signUpDto.userType ?? UserType.STUDENT;

    const user = await this.usersService.create({
      email: signUpDto.email,
      password: hashedPassword,
      firstName: signUpDto.firstName,
      lastName: signUpDto.lastName,
      phoneNumber: signUpDto.phoneNumber,
      countryCode: signUpDto.countryCode,
      provider: AuthProvider.LOCAL,
      emailVerified: false, // Not verified yet
      role: finalUserType,
    });

    // Create profile based on user type
    switch (finalUserType) {
      case UserType.STUDENT: {
        // Check if this is a sponsor URL signup
        let sponsorUrlData: { sponsorId: string; urlId: string } | null = null;
        if (signUpDto.sponsorCode) {
          try {
            const sponsorUrl = await this.sponsorsService.validateSponsorCode(
              signUpDto.sponsorCode,
            );
            sponsorUrlData = {
              sponsorId: sponsorUrl.sponsorId,
              urlId: sponsorUrl.id,
            };
          } catch {
            // Invalid/disabled sponsor code — register as a regular student
          }
        }

        // Resolve sponsor display name if this is a sponsor URL signup
        let sponsorDisplayName: string | undefined;
        if (sponsorUrlData) {
          try {
            const sponsorProfile = await this.sponsorsService.findByProfileId(
              sponsorUrlData.sponsorId,
            );
            if (sponsorProfile) {
              const sponsorUser = await this.usersService.findById(
                sponsorProfile.userId,
              );
              sponsorDisplayName =
                sponsorProfile.companyName ||
                `${sponsorUser?.firstName ?? ''} ${sponsorUser?.lastName ?? ''}`.trim() ||
                undefined;
            }
          } catch {
            // Don't fail signup if name lookup fails
          }
        }

        await this.studentsService.createStudentProfile({
          userId: user.id,
          examTypeId: signUpDto.examTypeId,
          phoneNumber: signUpDto.phoneNumber,
          countryCode: signUpDto.countryCode,
          isSponsored: !!sponsorUrlData,
          sponsorId: sponsorUrlData?.sponsorId ?? undefined,
          sponsorUrlId: sponsorUrlData?.urlId ?? undefined,
          sponsorDisplayName,
        });

        // Track sponsor URL usage (increment usedCount)
        if (sponsorUrlData) {
          try {
            await this.sponsorsService.trackSponsorUrlUsage(
              sponsorUrlData.urlId,
            );
            const sponsorProfile = await this.sponsorsService.findByProfileId(
              sponsorUrlData.sponsorId,
            );
            if (sponsorProfile) {
              await this.sponsorsService.incrementStudentsSponsored(
                sponsorProfile.id,
              );
            }
          } catch {
            // Don't fail signup if tracking fails
          }
        }

        // Students get an affiliate profile at signup so they can share a referral link
        // immediately. Commission is gated behind hasEverSubscribed in activateSubscription.
        await this.affiliatesService.createAffiliateProfile({
          userId: user.id,
          firstName: signUpDto.firstName,
          lastName: signUpDto.lastName,
        });
        break;
      }

      case UserType.SPONSOR:
        await this.sponsorsService.createSponsorProfile({
          userId: user.id,
          sponsorType:
            (signUpDto.sponsorType as SponsorType) ?? SponsorType.INDIVIDUAL,
          companyName: signUpDto.companyName,
          phoneNumber: signUpDto.phoneNumber,
          countryCode: signUpDto.countryCode,
        });
        // Sponsors can refer students (no commission, just tracking)
        await this.affiliatesService.createAffiliateProfile({
          userId: user.id,
          firstName: signUpDto.firstName,
          lastName: signUpDto.lastName,
        });
        break;

      case UserType.AFFILIATE:
        await this.affiliatesService.createAffiliateProfile({
          userId: user.id,
          firstName: signUpDto.firstName,
          lastName: signUpDto.lastName,
          affiliateCode: signUpDto.affiliateCode,
          phoneNumber: signUpDto.phoneNumber,
          countryCode: signUpDto.countryCode,
        });
        break;
    }

    // Track referral if user signed up with a referral code
    if (signUpDto.referralCode) {
      await this.trackReferral(signUpDto.referralCode, user.id, finalUserType);
    }

    // Generate 6-digit verification code
    const verificationCode = Math.floor(
      100000 + Math.random() * 900000,
    ).toString();

    // Store verification code
    const codeRecord = this.emailVerificationCodeRepo.create({
      code: verificationCode,
      userId: user.id,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    });

    await this.emailVerificationCodeRepo.save(codeRecord);

    // Send verification email with code (queued — side effect, does not block signup response)
    await this.emailQueue.add(
      EmailJobs.SEND_VERIFICATION,
      { email: signUpDto.email, verificationCode },
      { attempts: 5, backoff: { type: 'exponential', delay: 2000 } },
    );

    // Log user registration
    await this.loggerService.log({
      userId: user.id,
      action: LogActionTypes.SIGNUP,
      description: `User registered with email: ${signUpDto.email} as ${finalUserType}`,
      metadata: {
        email: signUpDto.email,
        userType: finalUserType,
        provider: AuthProvider.LOCAL,
      },
    });

    return { userId: user.id };
  }

  // Verify email with code
  async verifyEmail(email: string, code: string) {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const codeRecord = await this.emailVerificationCodeRepo.findOne({
      where: {
        userId: user.id,
        code,
        used: false,
      },
    });

    if (!codeRecord) {
      throw new UnauthorizedException('Invalid verification code');
    }

    if (codeRecord.expiresAt < new Date()) {
      await this.generateAndSendVerificationCode(user.id, user.email);
      await this.loggerService.log({
        userId: user.id,
        action: LogActionTypes.OTHER,
        description: `Auto-resent verification code on verify email (expired): ${user.email}`,
        metadata: { email: user.email },
      });
      throw new UnauthorizedException(
        'Verification code has expired. A new code has been sent to your email.',
      );
    }

    // Mark code as used
    codeRecord.used = true;
    await this.emailVerificationCodeRepo.save(codeRecord);

    // Mark user email as verified
    await this.usersService.update(user.id, { emailVerified: true });

    // Queue welcome email (non-blocking side effect)
    await this.emailQueue.add(
      EmailJobs.SEND_WELCOME,
      {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        userType: user.role ?? undefined,
      },
      { attempts: 5, backoff: { type: 'exponential', delay: 2000 } },
    );

    // Log email verification
    await this.loggerService.log({
      userId: user.id,
      action: LogActionTypes.OTHER,
      description: `User verified email: ${email}`,
      metadata: {
        email,
      },
    });

    return { message: 'Email verified successfully' };
  }

  // Helper: Generate and send verification code (used by register, resend, and expired code handling)
  private async generateAndSendVerificationCode(
    userId: string,
    email: string,
  ): Promise<void> {
    // Delete all old verification codes for this user
    await this.emailVerificationCodeRepo.delete({ userId });

    // Generate new 6-digit verification code
    const verificationCode = Math.floor(
      100000 + Math.random() * 900000,
    ).toString();

    // Store new verification code
    const codeRecord = this.emailVerificationCodeRepo.create({
      code: verificationCode,
      userId,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    });

    await this.emailVerificationCodeRepo.save(codeRecord);

    // Send verification email with new code
    await this.emailService.sendVerificationEmail(email, verificationCode);
  }

  // Resend verification code
  async resendVerificationCode(email: string) {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.emailVerified) {
      throw new UnauthorizedException('Email already verified');
    }

    // Generate and send new code (deletes old ones)
    await this.generateAndSendVerificationCode(user.id, email);

    return { message: 'Verification code resent successfully' };
  }

  // Generate temporary exchange token for OAuth callback
  generateExchangeToken(userId: string): string {
    const payload: ExchangeTokenPayload = {
      sub: userId,
    };

    return this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_SECRET'),
      expiresIn: '5m',
    });
  }

  // Get existing or create new onboarding token
  async getOrCreateOnboardingToken(
    userId: string,
    email: string,
  ): Promise<string> {
    // Check if user already has an unused onboarding token
    const existingToken = await this.onboardingTokenRepo.findOne({
      where: { userId, isUsed: false },
      order: { createdAt: 'DESC' }, // Get the most recent one
    });

    if (existingToken) {
      return existingToken.token;
    }

    // Create new token if none exists
    return await this.createOnboardingToken(userId, email);
  }

  // Create onboarding token (encrypts user email) - Private method
  private async createOnboardingToken(
    userId: string,
    email: string,
  ): Promise<string> {
    // Encrypt the email
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(
      this.configService.get('JWT_SECRET')!,
      'salt',
      32,
    );
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);

    let encrypted = cipher.update(email, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const token = `${iv.toString('hex')}:${encrypted}`;

    // Save to database
    const onboardingToken = this.onboardingTokenRepo.create({
      userId,
      token,
      isUsed: false,
    });

    await this.onboardingTokenRepo.save(onboardingToken);

    // Send onboarding email with the token (queued — side effect, does not block response)
    const user = await this.usersService.findById(userId);
    await this.emailQueue.add(
      EmailJobs.SEND_ONBOARDING,
      {
        email,
        firstName: user!.firstName,
        lastName: user!.lastName,
        onboardingToken: token,
      },
      { attempts: 5, backoff: { type: 'exponential', delay: 2000 } },
    );

    return token;
  }

  // Decrypt onboarding token to get email
  decryptOnboardingToken(token: string): string {
    const [ivHex, encrypted] = token.split(':');
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(
      this.configService.get('JWT_SECRET')!,
      'salt',
      32,
    );
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(algorithm, key, iv);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  // Validate and use onboarding token
  async validateOnboardingToken(token: string): Promise<User> {
    const onboardingToken = await this.onboardingTokenRepo.findOne({
      where: { token },
      relations: ['user'],
    });

    if (!onboardingToken) {
      throw new UnauthorizedException('Invalid onboarding token');
    }

    if (onboardingToken.isUsed) {
      throw new UnauthorizedException('Onboarding token already used');
    }

    // Decrypt token and verify email matches the user's email (prevent token manipulation)
    const decryptedEmail = this.decryptOnboardingToken(token);
    if (decryptedEmail !== onboardingToken.user.email) {
      // Log suspicious activity
      await this.loggerService.log({
        userId: onboardingToken.user.id,
        action: LogActionTypes.OTHER,
        description: `Onboarding token validation failed: email mismatch (expected: ${onboardingToken.user.email}, got: ${decryptedEmail})`,
        metadata: {
          tokenEmail: decryptedEmail,
          userEmail: onboardingToken.user.email,
          securityIssue: 'token_manipulation_attempt',
        },
      });

      throw new UnauthorizedException(
        'Token validation failed: email mismatch',
      );
    }

    return onboardingToken.user;
  }

  // Mark onboarding token as used
  async markOnboardingTokenAsUsed(token: string): Promise<void> {
    await this.onboardingTokenRepo.update(
      { token },
      { isUsed: true, usedAt: new Date() },
    );
  }

  // Local login — generates tokens, sets lastLogin, returns profile
  async loginUser(user: User, userAgent?: string, ipAddress?: string) {
    await this.usersService.update(user.id, { lastLogin: new Date() });

    const tokens = await this.generateTokens(user, userAgent, ipAddress);
    const profile = await this.getProfileData(user);

    await this.loggerService.log({
      userId: user.id,
      action: LogActionTypes.LOGIN,
      description: `User logged in: ${user.email}`,
      metadata: { email: user.email, provider: user.provider },
    });

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      profile,
    };
  }

  // Exchange temporary token for real tokens
  async exchangeToken(
    exchangeToken: string,
    userAgent?: string,
    ipAddress?: string,
  ) {
    let payload: ExchangeTokenPayload;
    try {
      payload = this.jwtService.verify(exchangeToken, {
        secret: this.configService.get('JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired exchange token');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    await this.usersService.update(user.id, { lastLogin: new Date() });

    const tokens = await this.generateTokens(user, userAgent, ipAddress);
    const profile = await this.getProfileData(user);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      profile,
    };
  }

  // Complete onboarding after Google/local signup
  async completeOnboarding(
    onboardingToken: string,
    payload: {
      userType: UserType;
      examTypeId?: string;
      subjectIds?: string[];
      sponsorType?: string;
      companyName?: string;
      affiliateCode?: string;
      referralCode?: string;
      sponsorCode?: string;
    },
    userAgent?: string,
    ipAddress?: string,
  ) {
    // Validate and get user from onboarding token
    const user = await this.validateOnboardingToken(onboardingToken);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    switch (payload.userType) {
      case UserType.STUDENT: {
        // Use service method to find profile
        let profile = await this.studentsService.findByUserId(user.id);

        if (!profile) {
          if (!payload.examTypeId) {
            throw new UnauthorizedException(
              'Exam type is required for student onboarding',
            );
          }

          // Resolve sponsor URL code if present
          let sponsorUrlData: { sponsorId: string; urlId: string } | null =
            null;
          if (payload.sponsorCode) {
            try {
              const sponsorUrl = await this.sponsorsService.validateSponsorCode(
                payload.sponsorCode,
              );
              sponsorUrlData = {
                sponsorId: sponsorUrl.sponsorId,
                urlId: sponsorUrl.id,
              };
            } catch {
              // Invalid/disabled sponsor code — register as regular student
            }
          }

          // Resolve sponsor display name if this is a sponsor URL signup
          let sponsorDisplayName: string | undefined;
          if (sponsorUrlData) {
            try {
              const sponsorProfile = await this.sponsorsService.findByProfileId(
                sponsorUrlData.sponsorId,
              );
              if (sponsorProfile) {
                const sponsorUser = await this.usersService.findById(
                  sponsorProfile.userId,
                );
                sponsorDisplayName =
                  sponsorProfile.companyName ||
                  `${sponsorUser?.firstName ?? ''} ${sponsorUser?.lastName ?? ''}`.trim() ||
                  undefined;
              }
            } catch {
              // Don't fail signup if name lookup fails
            }
          }

          // Use service method to create profile (also creates StudentExamType)
          profile = await this.studentsService.createStudentProfile({
            userId: user.id,
            examTypeId: payload.examTypeId,
            isSponsored: !!sponsorUrlData,
            sponsorId: sponsorUrlData?.sponsorId ?? undefined,
            sponsorUrlId: sponsorUrlData?.urlId ?? undefined,
            sponsorDisplayName,
          });

          // Track sponsor URL usage
          if (sponsorUrlData) {
            try {
              await this.sponsorsService.trackSponsorUrlUsage(
                sponsorUrlData.urlId,
              );
              const sponsorProfile = await this.sponsorsService.findByProfileId(
                sponsorUrlData.sponsorId,
              );
              if (sponsorProfile) {
                await this.sponsorsService.incrementStudentsSponsored(
                  sponsorProfile.id,
                );
              }
            } catch {
              // Don't fail onboarding if tracking fails
            }
          }
        }

        // Attach subjects to student's exam type
        if (payload.subjectIds?.length && payload.examTypeId) {
          await this.studentsService.updateExamTypeSubjects(
            profile.id,
            payload.examTypeId,
            payload.subjectIds,
          );
        }

        // Ensure affiliate profile exists for student (idempotent — signup may have already created it)
        const existingStudentAffiliateProfile =
          await this.affiliatesService.findByUserId(user.id);
        if (!existingStudentAffiliateProfile) {
          await this.affiliatesService.createAffiliateProfile({
            userId: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
          });
        }

        if (user.role !== UserType.STUDENT) {
          await this.usersService.update(user.id, { role: UserType.STUDENT });
          user.role = UserType.STUDENT;
        }
        break;
      }

      case UserType.SPONSOR: {
        // Use service method to find profile
        let profile = await this.sponsorsService.findByUserId(user.id);

        if (!profile) {
          // Use service method to create profile
          profile = await this.sponsorsService.createSponsorProfile({
            userId: user.id,
            sponsorType: payload.sponsorType as SponsorType,
            companyName: payload.companyName,
          });
        }

        // Sponsors can refer students (no commission, just tracking)
        const existingAffiliateProfile =
          await this.affiliatesService.findByUserId(user.id);
        if (!existingAffiliateProfile) {
          await this.affiliatesService.createAffiliateProfile({
            userId: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
          });
        }

        if (user.role !== UserType.SPONSOR) {
          await this.usersService.update(user.id, { role: UserType.SPONSOR });
          user.role = UserType.SPONSOR;
        }
        break;
      }

      case UserType.AFFILIATE: {
        // Use service method to find profile
        let profile = await this.affiliatesService.findByUserId(user.id);

        if (!profile) {
          // Use service method to create profile
          profile = await this.affiliatesService.createAffiliateProfile({
            userId: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            affiliateCode: payload.affiliateCode,
          });
        }

        if (user.role !== UserType.AFFILIATE) {
          await this.usersService.update(user.id, { role: UserType.AFFILIATE });
          user.role = UserType.AFFILIATE;
        }
        break;
      }

      default:
        break;
    }

    // Track referral if user completed onboarding with a referral code
    if (payload.referralCode) {
      await this.trackReferral(payload.referralCode, user.id, payload.userType);
    }

    // Mark onboarding token as used
    await this.markOnboardingTokenAsUsed(onboardingToken);

    // Send welcome email after successful onboarding (queued — side effect, does not block JWT response)
    await this.emailQueue.add(
      EmailJobs.SEND_WELCOME,
      {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        userType: user.role,
      },
      { attempts: 5, backoff: { type: 'exponential', delay: 2000 } },
    );

    // Log onboarding completion
    await this.loggerService.log({
      userId: user.id,
      action: LogActionTypes.CREATE,
      description: `User completed onboarding as ${payload.userType}`,
      metadata: {
        userType: payload.userType,
        email: user.email,
      },
    });

    // Set lastLogin for streak tracking
    await this.usersService.update(user.id, { lastLogin: new Date() });

    const tokens = await this.generateTokens(user, userAgent, ipAddress);
    const profileData = await this.getProfileData(user);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        phoneNumber: user.phoneNumber,
        countryCode: user.countryCode,
      },
      profile: profileData,
    };
  }

  // Fetch profile data for any user type (reused by login, exchange, onboarding)
  private async getProfileData(user: User): Promise<any> {
    switch (user.role) {
      case UserType.STUDENT: {
        const profile = await this.studentsService.findByUserId(user.id, [
          'defaultExamType',
        ]);
        if (profile) {
          return {
            id: profile.id,
            defaultExamTypeId: profile.defaultExamTypeId,
            lastExamTypeId: profile.lastExamTypeId || profile.defaultExamTypeId,
            totalQuestionsSolved: profile.totalQuestionsSolved,
            totalCorrect: profile.totalCorrect,
            totalWrong: profile.totalWrong,
            overallAccuracy: profile.overallAccuracy,
          };
        }
        break;
      }
      case UserType.SPONSOR: {
        const profile = await this.sponsorsService.findByUserId(user.id);
        if (profile) {
          return {
            id: profile.id,
            sponsorType: profile.sponsorType,
            companyName: profile.companyName,
            totalStudentsSponsored: profile.totalStudentsSponsored,
            totalAmountDonated: profile.totalAmountDonated,
          };
        }
        break;
      }
      case UserType.AFFILIATE: {
        const profile = await this.affiliatesService.findByUserId(user.id);
        if (profile) {
          return {
            id: profile.id,
            affiliateCode: profile.affiliateCode,
            totalReferrals: profile.totalReferrals,
            totalEarnings: profile.totalEarnings,
            pendingBalance: profile.pendingBalance,
          };
        }
        break;
      }
    }
    return null;
  }

  // Generate access + refresh tokens
  async generateTokens(user: User, userAgent?: string, ipAddress?: string) {
    const familyId = uuidv7();
    const refreshTokenString = this.generateSecureToken();
    const hashedRefreshToken = this.hashToken(refreshTokenString);

    const refreshTokenRecord = this.refreshTokenRepo.create({
      token: hashedRefreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      familyId,
      userAgent,
      ipAddress,
    });

    await this.refreshTokenRepo.save(refreshTokenRecord);

    const accessPayload: TokenPayload = {
      email: user.email,
      sub: user.id,
      role: user.role,
      refreshTokenId: refreshTokenRecord.id,
    };

    const accessToken = this.jwtService.sign(accessPayload, {
      secret: this.configService.get('JWT_SECRET'),
      expiresIn: '15m',
    });

    return {
      accessToken,
      refreshToken: refreshTokenString,
      expiresIn: 900,
    };
  }

  // Refresh tokens (with rotation)
  async refreshTokens(
    oldRefreshToken: string,
    userAgent?: string,
    ipAddress?: string,
  ) {
    const hashedToken = this.hashToken(oldRefreshToken);
    const storedToken = await this.refreshTokenRepo.findOne({
      where: { token: hashedToken, revoked: false },
      relations: ['user'],
    });

    if (!storedToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    if (!storedToken.user.isActive) {
      throw new UnauthorizedException('User is inactive');
    }

    // Revoke old token
    storedToken.revoked = true;
    await this.refreshTokenRepo.save(storedToken);

    // Generate new tokens
    return this.generateTokens(storedToken.user, userAgent, ipAddress);
  }

  /**
   * Validate access token by checking refresh token status.
   * This ensures that if a user logs out (refresh token revoked), the access token becomes invalid.
   * The access token carries a refreshTokenId, and we check the refresh token table on each request.
   *
   * NOTE: This could be optimized later by moving access token validation to Redis for better performance,
   * while keeping refresh token management in the database. For now, this DB lookup ensures consistency.
   */
  async validateAccessTokenPayload(payload: TokenPayload): Promise<User> {
    const refreshToken = await this.refreshTokenRepo.findOne({
      where: { id: payload.refreshTokenId },
      relations: [
        'user',
        'user.studentProfile',
        'user.sponsorProfile',
        'user.affiliateProfile',
      ],
    });

    if (!refreshToken || refreshToken.revoked) {
      throw new UnauthorizedException(
        'Session has been revoked. Please login again.',
      );
    }

    if (refreshToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Session expired. Please login again.');
    }

    if (!refreshToken.user.isActive) {
      throw new UnauthorizedException('User account is inactive');
    }

    return refreshToken.user;
  }

  // Logout (revoke entire refresh token family)
  async logout(refreshTokenId: string) {
    // First get the token to find its family
    const token = await this.refreshTokenRepo.findOne({
      where: { id: refreshTokenId },
    });

    if (token?.familyId) {
      // Revoke all tokens in the same family
      await this.refreshTokenRepo.update(
        { familyId: token.familyId },
        { revoked: true },
      );
    } else {
      // Fallback: just revoke this specific token
      await this.refreshTokenRepo.update(
        { id: refreshTokenId },
        { revoked: true },
      );
    }
  }

  // Logout from all devices
  async logoutAll(userId: string) {
    await this.refreshTokenRepo.update(
      { userId, revoked: false },
      { revoked: true },
    );
  }

  // ========== Sponsored Student Activation ==========

  /**
   * Validate a sponsor URL code (used by frontend before showing the signup form).
   * Returns basic sponsor info (name) so the frontend can display it.
   */
  async validateSponsorCode(code: string) {
    const url = await this.sponsorsService.validateSponsorCode(code);
    const sponsor = await this.sponsorsService.findByProfileId(url.sponsorId);
    return {
      valid: true,
      sponsorName: sponsor?.companyName ?? 'Your sponsor',
      label: url.label,
    };
  }

  /**
   * Sponsored student activates their account by setting a password.
   * Token is the raw token from the email URL — we hash it to find the invite.
   */
  async activateSponsoredAccount(rawToken: string, password: string) {
    const hashedToken = this.hashToken(rawToken);

    const invite = await this.sponsorsService.findInviteByToken(hashedToken);

    if (!invite) {
      throw new UnauthorizedException('Invalid or expired activation link.');
    }

    if (invite.status !== SponsorInviteStatus.PENDING) {
      throw new UnauthorizedException(
        'This activation link has already been used.',
      );
    }

    if (invite.expiresAt < new Date()) {
      throw new UnauthorizedException(
        'This activation link has expired. Please contact your sponsor.',
      );
    }

    // Find the user account created by the sponsor
    const user = await this.usersService.findByEmail(invite.studentEmail);
    if (!user) {
      throw new UnauthorizedException('Account not found.');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Activate the account
    await this.usersService.update(user.id, {
      password: hashedPassword,
      isActive: true,
    });

    // Mark invite as accepted
    await this.sponsorsService.markInviteAccepted(invite.id);

    await this.loggerService.log({
      userId: user.id,
      action: LogActionTypes.OTHER,
      description: `Sponsored student activated account: ${user.email}`,
      metadata: { inviteId: invite.id, sponsorId: invite.sponsorId },
    });

    return { message: 'Account activated successfully. You can now log in.' };
  }

  /**
   * Track affiliate referral — silently ignores invalid codes
   */
  private async trackReferral(
    referralCode: string,
    userId: string,
    userType: UserType,
  ): Promise<void> {
    try {
      const affiliate =
        await this.affiliatesService.findByAffiliateCode(referralCode);
      if (!affiliate) return;

      // Don't let affiliates refer themselves
      if (affiliate.userId === userId) return;

      // Map UserType to ReferredUserType
      const referredUserType =
        userType === UserType.SPONSOR
          ? ReferredUserType.SPONSOR
          : ReferredUserType.STUDENT;

      await this.affiliatesService.createReferral({
        affiliateId: affiliate.id,
        referredUserId: userId,
        userType: referredUserType,
      });
    } catch {
      // Silently ignore referral errors — don't block signup
    }
  }

  // Helpers
  private generateSecureToken(): string {
    return crypto.randomBytes(64).toString('hex');
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  // Cleanup expired tokens (run via cron)
  async cleanupExpiredTokens() {
    await this.refreshTokenRepo.delete({
      expiresAt: LessThan(new Date()),
    });
  }

  // ========== Forgot Password ==========

  async requestPasswordReset(email: string) {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      // Don't reveal if email exists or not (security best practice)
      return { message: 'If email exists, password reset link has been sent' };
    }

    if (user.provider === AuthProvider.GOOGLE) {
      throw new UnauthorizedException(
        'This account uses Google login. Password reset is not available.',
      );
    }

    // Generate reset token
    const resetTokenString = this.generateSecureToken();
    const hashedToken = this.hashToken(resetTokenString);

    // One thing to note here is that the token is hashed before saving to the database, this is to prevent the token from being exposed in the database. Another thing is that tokens are issued without throttle as long as there's a request from the front end, we may consider implementing a throttle mechanism later, or maybe deleting previous entries in the database before issuing a new token.

    // Save to database
    const resetToken = this.passwordResetTokenRepo.create({
      token: hashedToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    });

    await this.passwordResetTokenRepo.save(resetToken);

    // Send password reset email (queued — still reliable via BullMQ retries)
    await this.emailQueue.add(
      EmailJobs.SEND_PASSWORD_RESET,
      { email, resetToken: resetTokenString },
      { attempts: 5, backoff: { type: 'exponential', delay: 2000 } },
    );

    return { message: 'Password reset link sent to your email' };
  }

  async resetPassword(token: string, newPassword: string) {
    const hashedToken = this.hashToken(token);

    const resetToken = await this.passwordResetTokenRepo.findOne({
      where: { token: hashedToken, used: false },
      relations: ['user'],
    });

    if (!resetToken) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    if (resetToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Reset token has expired');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user password
    await this.usersService.update(resetToken.userId, {
      password: hashedPassword,
    });

    // If user was GOOGLE-only, upgrade to DUAL since they now have a password, redundant, since we don't allow google only users to request a password reset but keeping it here for future reference.
    if (resetToken.user.provider === AuthProvider.GOOGLE) {
      await this.usersService.update(resetToken.userId, {
        provider: AuthProvider.DUAL,
      });
    }

    // Mark token as used
    resetToken.used = true;
    await this.passwordResetTokenRepo.save(resetToken);

    // Revoke all refresh tokens (force re-login)
    await this.logoutAll(resetToken.userId);

    void this.loggerService.log({
      userId: resetToken.userId,
      action: LogActionTypes.UPDATE,
      description: 'Password reset completed successfully',
    });

    return { message: 'Password reset successful. Please login again.' };
  }
}
