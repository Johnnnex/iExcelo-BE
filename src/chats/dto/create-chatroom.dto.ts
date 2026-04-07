import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ArrayMinSize,
} from 'class-validator';

export class CreateChatroomDto {
  /** One or more student userIds to open DMs with */
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  studentUserIds: string[];

  /** Optional first message to send into each new chatroom */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  initialMessage?: string;
}
