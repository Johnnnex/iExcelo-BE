import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { SponsorType, UserType } from '../../../types';

export class SignUpDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsOptional()
  @IsEnum(UserType)
  userType?: UserType;

  // Student-specific fields
  @IsOptional()
  @IsString()
  examTypeId?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  countryCode?: string;

  // Sponsor-specific fields
  @IsOptional()
  @IsEnum(SponsorType)
  sponsorType?: SponsorType;

  @IsOptional()
  @IsString()
  companyName?: string;

  // Affiliate-specific fields (usually auto-generated, but can be provided)
  @IsOptional()
  @IsString()
  affiliateCode?: string;

  // Referral tracking — affiliate code of the person who referred this user
  @IsOptional()
  @IsString()
  referralCode?: string;

  // Sponsor URL signup — code from /signup/s/:code
  @IsOptional()
  @IsString()
  sponsorCode?: string;
}

export class VerifyEmailDto {
  @IsEmail()
  email: string;

  @IsString()
  code: string; // 6-digit verification code
}

export class CompleteOnboardingDto {
  @IsEnum(UserType)
  userType: UserType;

  // Common fields
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  countryCode?: string;

  // Student-specific fields
  @IsOptional()
  @IsString()
  examTypeId?: string;

  @IsOptional()
  @IsString({ each: true })
  subjectIds?: string[];

  // Sponsor-specific fields
  @IsOptional()
  @IsString()
  sponsorType?: string;

  @IsOptional()
  @IsString()
  companyName?: string;

  // Affiliate-specific fields
  @IsOptional()
  @IsString()
  affiliateCode?: string;

  // Referral tracking — affiliate code of the person who referred this user
  @IsOptional()
  @IsString()
  referralCode?: string;

  // Sponsor URL signup — code from /signup/s/:code (for Google OAuth students)
  @IsOptional()
  @IsString()
  sponsorCode?: string;
}

export class ExchangeTokenDto {
  @IsString()
  token: string;
}

export class RefreshTokenDto {
  @IsString()
  refreshToken: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @IsString()
  token: string;

  @IsString()
  @MinLength(8)
  newPassword: string;
}

/** Sponsored student activates their account by setting a password. */
export class ActivateSponsoredAccountDto {
  @IsString()
  token: string; // Raw token from the email URL

  @IsString()
  @MinLength(8)
  password: string;
}
