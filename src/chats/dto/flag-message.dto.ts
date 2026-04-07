import { IsOptional, IsString, MaxLength } from 'class-validator';

export class FlagMessageDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
