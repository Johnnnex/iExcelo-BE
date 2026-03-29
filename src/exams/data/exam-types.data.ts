import { QuestionCategory } from '../../../types';

export const examTypesData = [
  {
    name: 'JAMB',
    description:
      'Joint Admissions and Matriculation Board - A standardized entrance examination for tertiary institutions in Nigeria. Required for university admission.',
    minSubjectsSelectable: 4,
    maxSubjectsSelectable: 4,
    freeTierQuestionLimit: 40, // 40% of the real 100-question JAMB exam
    supportedCategories: [QuestionCategory.OBJECTIVES],
    isActive: true,
  },
  {
    name: 'WAEC',
    description:
      'West African Examinations Council - A comprehensive secondary school leaving examination recognized across West Africa. Essential for university and employment applications.',
    minSubjectsSelectable: 8,
    maxSubjectsSelectable: 9,
    freeTierQuestionLimit: 20, // ~33% of a 60-question WAEC objectives paper
    supportedCategories: [
      QuestionCategory.OBJECTIVES,
      QuestionCategory.THEORY,
      QuestionCategory.PRACTICAL,
    ],
    isActive: true,
  },
  {
    name: 'NECO',
    description:
      'National Examinations Council - Nigerian alternative to WAEC for secondary school certification. Widely accepted for tertiary institution admission and employment.',
    minSubjectsSelectable: 8,
    maxSubjectsSelectable: 9,
    freeTierQuestionLimit: 20, // ~33% of a 60-question NECO objectives paper
    supportedCategories: [
      QuestionCategory.OBJECTIVES,
      QuestionCategory.THEORY,
      QuestionCategory.PRACTICAL,
    ],
    isActive: true,
  },
  {
    name: 'POST-JAMB',
    description:
      'Post-UTME screening examination conducted by individual Nigerian universities after JAMB. Used for final admission selection into specific institutions.',
    minSubjectsSelectable: 3,
    maxSubjectsSelectable: 4,
    freeTierQuestionLimit: 20, // 40% of the typical 50-question Post-UTME
    supportedCategories: [QuestionCategory.OBJECTIVES],
    isActive: true,
  },
  {
    name: 'GCE',
    description:
      'General Certificate of Education - International secondary education qualification. Offers O-Level and A-Level certifications recognized globally.',
    minSubjectsSelectable: 5,
    maxSubjectsSelectable: 8,
    freeTierQuestionLimit: 20, // 40% of the typical 50-question GCE paper
    supportedCategories: [
      QuestionCategory.OBJECTIVES,
      QuestionCategory.THEORY,
      QuestionCategory.PRACTICAL,
    ],
    isActive: true,
  },
  {
    name: 'SAT',
    description:
      'Scholastic Assessment Test - Standardized test widely used for college admissions in the United States and internationally. Measures readiness for higher education.',
    minSubjectsSelectable: 3,
    maxSubjectsSelectable: 3,
    freeTierQuestionLimit: 15, // ~34% of the 44-question SAT Math section
    supportedCategories: [QuestionCategory.OBJECTIVES],
    isActive: true,
  },
];
