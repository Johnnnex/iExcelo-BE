import { Injectable } from '@nestjs/common';
import { QuestionType, GradeResult, QuestionAnswer } from '../../../types';
import { Question } from '../entities/question.entity';

@Injectable()
export class GradingService {
  /**
   * Grades a single student response against the question's correctAnswer.
   * Returns a GradeResult describing correctness, marks, and whether the
   * question is exempt from accuracy metrics (essays).
   */
  gradeQuestion(
    question: Question,
    studentAnswer: QuestionAnswer,
  ): GradeResult {
    switch (question.type as QuestionType) {
      case QuestionType.MULTIPLE_CHOICE:
      case QuestionType.TRUE_FALSE:
        return this.gradeExactMatch(question, studentAnswer as string);

      case QuestionType.FILL_IN_THE_BLANK:
        return this.gradeFillInBlank(question, studentAnswer as string);

      case QuestionType.SHORT_ANSWER:
        return this.gradeShortAnswer(question, studentAnswer as string);

      case QuestionType.MULTIPLE_RESPONSE:
        return this.gradeMultipleResponse(question, studentAnswer as string[]);

      case QuestionType.MATCHING:
        return this.gradeMatching(
          question,
          studentAnswer as Record<string, string>,
        );

      case QuestionType.ESSAY:
        // Essays are exempt from accuracy metrics — never graded automatically.
        // correctAnswer stores the examiner's model answer shown to student
        // in revision/timed mode as reference.
        return {
          isCorrect: null,
          marksAwarded: 0,
          feedback: 'Essay submitted',
          exemptFromMetrics: true,
        };

      default:
        return { isCorrect: false, marksAwarded: 0 };
    }
  }

  // ─── Private Graders ──────────────────────────────────────────────────────

  private gradeExactMatch(question: Question, answer: string): GradeResult {
    const isCorrect = answer === (question.correctAnswer as string);
    return { isCorrect, marksAwarded: isCorrect ? question.marks : 0 };
  }

  private gradeFillInBlank(question: Question, answer: string): GradeResult {
    const correct = question.correctAnswer as string;
    const caseSensitive = question.validationConfig?.caseSensitive ?? false;
    const normalize = (s: string) =>
      caseSensitive ? s.trim() : s.trim().toLowerCase();
    const isCorrect = normalize(answer) === normalize(correct);
    return { isCorrect, marksAwarded: isCorrect ? question.marks : 0 };
  }

  private gradeShortAnswer(question: Question, answer: string): GradeResult {
    const keywords = question.correctAnswer as string[];
    const minMatch =
      question.validationConfig?.keywordMinMatch ?? keywords.length;
    const answerLower = answer.toLowerCase();
    const matched = keywords.filter((kw) =>
      answerLower.includes(kw.toLowerCase()),
    );
    const isCorrect = matched.length >= minMatch;
    const marksAwarded = question.validationConfig?.allowPartialCredit
      ? (matched.length / keywords.length) * question.marks
      : isCorrect
        ? question.marks
        : 0;
    return {
      isCorrect,
      marksAwarded,
      feedback: `Matched ${matched.length}/${keywords.length} keywords`,
    };
  }

  private gradeMultipleResponse(
    question: Question,
    answers: string[],
  ): GradeResult {
    const correct = question.correctAnswer as string[];
    const isCorrect =
      Array.isArray(answers) &&
      answers.length === correct.length &&
      answers.every((a) => correct.includes(a));
    return { isCorrect, marksAwarded: isCorrect ? question.marks : 0 };
  }

  private gradeMatching(
    question: Question,
    studentPairs: Record<string, string>,
  ): GradeResult {
    const correctPairs = question.correctAnswer as Record<string, string>;
    const total = Object.keys(correctPairs).length;
    const correctCount = Object.entries(correctPairs).filter(
      ([k, v]) => studentPairs[k] === v,
    ).length;
    const isCorrect = correctCount === total;
    const marksAwarded = question.validationConfig?.allowPartialCredit
      ? (correctCount / total) * question.marks
      : isCorrect
        ? question.marks
        : 0;
    return {
      isCorrect,
      marksAwarded,
      feedback: `${correctCount}/${total} pairs correct`,
    };
  }
}
