import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
// Note: IsNotEmpty is kept for examAttemptId + questionId; answer is @IsOptional
import { FlagReasons } from '../../../types';

class QuestionResponseDto {
  @IsNotEmpty()
  @IsString()
  questionId: string;

  /** Polymorphic — shape must match the question type:
   *  MULTIPLE_CHOICE / TRUE_FALSE / FILL_IN_THE_BLANK / SHORT_ANSWER / ESSAY → string
   *  MULTIPLE_RESPONSE → string[]
   *  MATCHING → Record<string, string>
   *  Empty string / undefined = skipped question (valid — students need not answer all).
   */
  @IsOptional()
  answer: any;

  /** Seconds the student spent on this question (client-reported, for display only). */
  @IsNumber()
  timeSpent: number;

  /** True if the student flagged this question during the exam. */
  @IsOptional()
  @IsBoolean()
  isFlagged?: boolean;

  /** Reason for the flag — required when isFlagged = true. */
  @IsOptional()
  @IsEnum(FlagReasons)
  flagType?: FlagReasons;

  /** Optional free-text note from the student (e.g. "Option B looks wrong"). */
  @IsOptional()
  @IsString()
  flagReason?: string;
}

class FlagUpdateDto {
  @IsNotEmpty()
  @IsString()
  questionId: string;

  /** true = flag/re-flag, false = remove flag */
  @IsBoolean()
  isFlagged: boolean;

  @IsOptional()
  @IsEnum(FlagReasons)
  flagType?: FlagReasons;

  @IsOptional()
  @IsString()
  flagReason?: string;
}

export class SubmitExamDto {
  @IsNotEmpty()
  @IsString()
  examAttemptId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionResponseDto)
  questionResponses: QuestionResponseDto[];

  /** Total exam time in seconds (client-reported, for reference only).
   *  Backend always uses (now - startedAt) for anti-cheat. */
  @IsNumber()
  totalTimeSpent: number;

  /**
   * Explicit flag state changes for this session.
   * Covers both new flags on unanswered questions and removals (unflagging).
   * Processed after grading — can be moved to a message queue later.
   */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FlagUpdateDto)
  flagUpdates?: FlagUpdateDto[];
}
