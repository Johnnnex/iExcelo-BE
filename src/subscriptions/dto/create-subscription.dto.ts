import { IsUUID, IsOptional, IsString } from 'class-validator';
import { PaymentProvider } from '../../../types';

export class InitiateSubscriptionDto {
  @IsUUID()
  planId: string;

  @IsUUID()
  examTypeId: string;

  @IsString()
  region: string; // Region code for currency/provider detection

  @IsOptional()
  @IsString()
  redirectUrl?: string; // Optional redirect URL after payment
}

export class GiftSubscriptionDto {
  @IsUUID()
  studentId: string;

  @IsUUID()
  planId: string;

  @IsUUID()
  examTypeId: string;

  @IsString()
  region: string;
}

export class UpgradeSubscriptionDto {
  @IsUUID()
  targetPlanId: string;

  @IsUUID()
  examTypeId: string;
}

// Internal DTO for creating subscription (not exposed to API)
export class CreateSubscriptionDto {
  studentId: string;
  examTypeId: string;
  planId: string;
  planPriceId: string; // Links to the exact PlanPrice (currency-specific) being purchased
  sponsorId?: string;
  provider: PaymentProvider;
  currency: string;
  amount: number;
  providerSubscriptionId?: string;
  providerCustomerId?: string;
}
