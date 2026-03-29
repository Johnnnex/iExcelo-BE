import { ExamConfigModes } from '../../../types';

export interface ExamConfigSeed {
  examTypeName: string;
  mode: ExamConfigModes;
  standardDurationMinutes: number | null;
  standardQuestionCount: number | null;
  rules: Record<string, any> | null;
}

/**
 * Mock-mode configurations per exam type.
 * TIMED and REVISION modes are student-configured — no config row needed.
 *
 * Sources:
 * - JAMB UTME: 100 questions, 2 hours (current format, all objectives)
 * - WAEC: 60 objectives per paper, 1 hour 30 min (objectives paper)
 * - NECO: 60 objectives per paper, 1 hour 30 min
 * - POST-JAMB: ~50 questions, 60 minutes (institution-specific — using a typical average)
 * - GCE O-Level: 50 objectives, 1 hour 15 min
 * - SAT (Math): 44 questions, 70 minutes
 */
export const examConfigsSeedData: ExamConfigSeed[] = [
  {
    examTypeName: 'JAMB',
    mode: ExamConfigModes.MOCK,
    standardDurationMinutes: 120,
    standardQuestionCount: 100,
    rules: {
      subjectsRequired: 4,
      perSubjectCount: 25,
    },
  },
  {
    examTypeName: 'WAEC',
    mode: ExamConfigModes.MOCK,
    standardDurationMinutes: 90,
    standardQuestionCount: 60,
    rules: {
      note: 'Theory and practical sections are handled separately as standalone sessions.',
    },
  },
  {
    examTypeName: 'NECO',
    mode: ExamConfigModes.MOCK,
    standardDurationMinutes: 90,
    standardQuestionCount: 60,
    rules: {
      note: 'Theory and practical sections are handled separately as standalone sessions.',
    },
  },
  {
    examTypeName: 'POST-JAMB',
    mode: ExamConfigModes.MOCK,
    standardDurationMinutes: 60,
    standardQuestionCount: 50,
    rules: {
      subjectsRequired: 4,
      note: 'Question count and duration vary by institution — these are typical averages.',
    },
  },
  {
    examTypeName: 'GCE',
    mode: ExamConfigModes.MOCK,
    standardDurationMinutes: 75,
    standardQuestionCount: 50,
    rules: {
      note: 'GCE O-Level Paper 1 (objectives). Paper 2 (essays/structured) is a separate session.',
    },
  },
  {
    examTypeName: 'SAT',
    mode: ExamConfigModes.MOCK,
    standardDurationMinutes: 70,
    standardQuestionCount: 44,
    rules: {
      note: 'SAT Math section. Reading & Writing section is a separate session.',
    },
  },
];
