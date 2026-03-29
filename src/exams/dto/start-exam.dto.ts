import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ExamTypes, QuestionCategory, QuestionFilter } from '../../../types';

export class StartExamDto {
  @IsNotEmpty()
  @IsString()
  examTypeId: string;

  @IsNotEmpty()
  @IsEnum(ExamTypes)
  mode: ExamTypes;

  @IsArray()
  @IsString({ each: true })
  selectedSubjectIds: string[];

  /** For timed and revision modes — ignored for mock (uses ExamConfig). Free tier ignores this too. */
  @IsOptional()
  @IsNumber()
  @Min(1)
  questionCount?: number;

  /** For timed mode only — student-configured duration in seconds. */
  @IsOptional()
  @IsNumber()
  @Min(60)
  timeLimitSeconds?: number;

  /**
   * Optional category filter — only meaningful for exam types with multiple
   * categories (e.g. WAEC: objectives | theory | practical).
   * If omitted, all questions from the pool are included regardless of category.
   * Must be one of the exam type's supportedCategories — validated in the service.
   */
  @IsOptional()
  @IsEnum(QuestionCategory)
  category?: QuestionCategory;

  /**
   * Question selection filter for paid users only.
   * Demo users always receive MIXED within the free-tier pool regardless of this field.
   * Defaults to MIXED when omitted.
   */
  @IsOptional()
  @IsEnum(QuestionFilter)
  questionFilter?: QuestionFilter;

  /**
   * Optional topic IDs the student selected before starting the exam.
   * Questions tagged with these topics are prioritised first for each subject;
   * the remainder of the quota is filled from the general pool so the session
   * is always full-sized even if fewer topic-tagged questions exist.
   */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectedTopicIds?: string[];
}
