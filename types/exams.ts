// ─── Question Content Types ───────────────────────────────────────────────────

/**
 * A single option in a question. All text fields are Markdown + LaTeX strings.
 * Images are embedded inline: ![alt](url)
 */
export interface QuestionOption {
  id: string; // "A", "B", "C", "D" or "1", "2", etc.
  text: string; // Markdown + LaTeX — can include ![](url) for image options
  isCorrect: boolean; // Server-side only — NEVER sent to students
}

/**
 * Polymorphic answer type that covers all question types:
 *   MULTIPLE_CHOICE   → string  (e.g., "A")
 *   TRUE_FALSE        → string  ("true" | "false")
 *   FILL_IN_THE_BLANK → string  (student's text input)
 *   SHORT_ANSWER      → string  (student's text, checked against keywords)
 *   MULTIPLE_RESPONSE → string[] (e.g., ["A", "C"])
 *   MATCHING          → Record<string, string> (e.g., { "A": "1", "B": "3" })
 *   ESSAY             → string  (student's essay text)
 */
export type QuestionAnswer = string | string[] | Record<string, string>;

// ─── Grading ─────────────────────────────────────────────────────────────────

export interface GradeResult {
  /** null = essay (exempt from metrics, not graded) */
  isCorrect: boolean | null;
  marksAwarded: number;
  feedback?: string;
  /** When true, this question is excluded from accuracy/correct/wrong counts */
  exemptFromMetrics?: boolean;
}

// ─── Subject-Level Stats (used internally during submission grading) ──────────

export interface SubjectGradeStats {
  questionsAttempted: number;
  questionsCorrect: number;
  questionsWrong: number;
  essayQuestionsAttempted: number;
}
