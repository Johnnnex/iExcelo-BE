import { QuestionCategory } from '../../../types';

// Names that match subjects.data.ts entries for practical subjects
const PRACTICAL_SUBJECT_NAMES = [
  'Biology',
  'Agricultural Science',
  'Physics',
  'Chemistry',
];

export const examTypesData = [
  {
    name: 'JAMB',
    description:
      'Joint Admissions and Matriculation Board - A standardized entrance examination for tertiary institutions in Nigeria. Required for university admission.',
    minSubjectsSelectable: 4,
    maxSubjectsSelectable: 4,
    freeTierQuestionLimit: 40,
    supportedCategories: [QuestionCategory.OBJECTIVES],
    practicalSubjectNames: [] as string[],
    isActive: true,
  },
  {
    name: 'WAEC',
    description:
      'West African Examinations Council - A comprehensive secondary school leaving examination recognized across West Africa. Essential for university and employment applications.',
    minSubjectsSelectable: 8,
    maxSubjectsSelectable: 9,
    freeTierQuestionLimit: 20,
    supportedCategories: [
      QuestionCategory.OBJECTIVES,
      QuestionCategory.THEORY,
      QuestionCategory.PRACTICAL,
    ],
    practicalSubjectNames: PRACTICAL_SUBJECT_NAMES,
    isActive: true,
  },
  {
    name: 'NECO',
    description:
      'National Examinations Council - Nigerian alternative to WAEC for secondary school certification. Widely accepted for tertiary institution admission and employment.',
    minSubjectsSelectable: 8,
    maxSubjectsSelectable: 9,
    freeTierQuestionLimit: 20,
    supportedCategories: [
      QuestionCategory.OBJECTIVES,
      QuestionCategory.THEORY,
      QuestionCategory.PRACTICAL,
    ],
    practicalSubjectNames: PRACTICAL_SUBJECT_NAMES,
    isActive: true,
  },
  {
    name: 'POST-JAMB',
    description:
      'Post-UTME screening examination conducted by individual Nigerian universities after JAMB. Used for final admission selection into specific institutions.',
    minSubjectsSelectable: 3,
    maxSubjectsSelectable: 4,
    freeTierQuestionLimit: 20,
    supportedCategories: [QuestionCategory.OBJECTIVES],
    practicalSubjectNames: [] as string[],
    isActive: true,
  },
  {
    name: 'GCE',
    description:
      'General Certificate of Education - International secondary education qualification. Offers O-Level and A-Level certifications recognized globally.',
    minSubjectsSelectable: 5,
    maxSubjectsSelectable: 9,
    freeTierQuestionLimit: 20,
    supportedCategories: [
      QuestionCategory.OBJECTIVES,
      QuestionCategory.THEORY,
      QuestionCategory.PRACTICAL,
    ],
    practicalSubjectNames: PRACTICAL_SUBJECT_NAMES,
    isActive: true,
  },
  {
    name: 'SAT',
    description:
      'Scholastic Assessment Test - Standardized test widely used for college admissions in the United States and internationally. Measures readiness for higher education.',
    minSubjectsSelectable: 3,
    maxSubjectsSelectable: 3,
    freeTierQuestionLimit: 15,
    supportedCategories: [QuestionCategory.OBJECTIVES],
    practicalSubjectNames: [] as string[],
    isActive: true,
  },
];
