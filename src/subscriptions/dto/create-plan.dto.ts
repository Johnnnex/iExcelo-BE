import {
  IsUUID,
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsEnum,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Currency } from '../../../types';

export class PlanPriceDto {
  @IsEnum(Currency)
  currency: Currency;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsOptional()
  @IsString()
  stripePriceId?: string;

  @IsOptional()
  @IsString()
  paystackPlanCode?: string;
}

export class CreateSubscriptionPlanDto {
  @IsUUID()
  examTypeId: string;

  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(1)
  durationDays: number;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlanPriceDto)
  prices?: PlanPriceDto[];
}

export class UpdateSubscriptionPlanDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  durationDays?: number;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpsertPlanPriceDto {
  @IsEnum(Currency)
  currency: Currency;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsOptional()
  @IsString()
  stripePriceId?: string;

  @IsOptional()
  @IsString()
  paystackPlanCode?: string;
}
