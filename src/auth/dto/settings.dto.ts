import { IsString, IsOptional, MinLength, IsBoolean } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  countryCode?: string;

  @IsOptional()
  @IsString()
  picture?: string;
}

export class ChangePasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  @MinLength(8)
  newPassword: string;
}

export class UpdateNotificationPrefsDto {
  @IsOptional()
  @IsBoolean()
  newsletterOptIn?: boolean;

  @IsOptional()
  @IsBoolean()
  promotionsOptIn?: boolean;

  @IsOptional()
  @IsBoolean()
  productUpdatesOptIn?: boolean;

  @IsOptional()
  @IsBoolean()
  securityAlertsOptIn?: boolean;
}
