import { IsOptional, IsInt, IsString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class GetMessagesDto {
  /** Cursor: fetch messages created BEFORE this messageId (for scrolling up) */
  @IsOptional()
  @IsString()
  before?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 30;
}

export class GetChatroomsDto {
  /** Cursor: chatroomId to start after (ordered by last message time) */
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  /** Search by partner name (ILIKE) */
  @IsOptional()
  @IsString()
  query?: string;
}

export class GetPresenceDto {
  /** Comma-separated userIds, max 50 */
  @IsString()
  userIds: string;
}

export class SearchStudentsDto {
  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number = 10;
}
