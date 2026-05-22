// Subjects mapped to exam types
export const subjectsData = [
  // ── JAMB Subjects ────────────────────────────────────────────────────────────
  // Geography removed (no questions in legacy data)
  {
    name: 'English Language',
    examTypeName: 'JAMB',
    description: 'Compulsory for all JAMB candidates',
    isCompulsory: true,
  },
  {
    name: 'Mathematics',
    examTypeName: 'JAMB',
    description: 'Core subject for science and engineering courses',
    isCompulsory: false,
  },
  {
    name: 'Physics',
    examTypeName: 'JAMB',
    description: 'Essential for engineering and physical sciences',
    isCompulsory: false,
  },
  {
    name: 'Chemistry',
    examTypeName: 'JAMB',
    description: 'Required for medical, pharmaceutical, and science courses',
    isCompulsory: false,
  },
  {
    name: 'Biology',
    examTypeName: 'JAMB',
    description: 'Core subject for medical and biological sciences',
    isCompulsory: false,
  },
  {
    name: 'Economics',
    examTypeName: 'JAMB',
    description: 'Key subject for business and social science courses',
    isCompulsory: false,
  },
  {
    name: 'Commerce',
    examTypeName: 'JAMB',
    description: 'Important for business administration and accounting',
    isCompulsory: false,
  },
  {
    name: 'Accounting',
    examTypeName: 'JAMB',
    description: 'Essential for accounting and finance programs',
    isCompulsory: false,
  },
  {
    name: 'Government',
    examTypeName: 'JAMB',
    description: 'Core for law, political science, and public administration',
    isCompulsory: false,
  },
  {
    name: 'Literature in English',
    examTypeName: 'JAMB',
    description: 'Required for arts and humanities programs',
    isCompulsory: false,
  },
  {
    name: 'Agricultural Science',
    examTypeName: 'JAMB',
    description: 'Core subject for agriculture and related fields',
    isCompulsory: false,
  },
  {
    name: 'Civic Education',
    examTypeName: 'JAMB',
    description: 'Promotes citizenship and civic responsibilities',
    isCompulsory: false,
  },
  {
    name: 'Christian Religious Studies',
    examTypeName: 'JAMB',
    description: 'Religious education option',
    isCompulsory: false,
  },
  {
    name: 'Islamic Studies',
    examTypeName: 'JAMB',
    description: 'Islamic religious education',
    isCompulsory: false,
  },

  // ── WAEC Subjects ────────────────────────────────────────────────────────────
  // Removed: Further Mathematics, French, Computer Studies, Geography
  {
    name: 'English Language',
    examTypeName: 'WAEC',
    description: 'Compulsory core subject',
    isCompulsory: true,
  },
  {
    name: 'Mathematics',
    examTypeName: 'WAEC',
    description: 'Compulsory core subject',
    isCompulsory: true,
  },
  {
    name: 'Physics',
    examTypeName: 'WAEC',
    description: 'Science elective',
    isCompulsory: false,
  },
  {
    name: 'Chemistry',
    examTypeName: 'WAEC',
    description: 'Science elective',
    isCompulsory: false,
  },
  {
    name: 'Biology',
    examTypeName: 'WAEC',
    description: 'Science elective',
    isCompulsory: true,
  },
  {
    name: 'Economics',
    examTypeName: 'WAEC',
    description: 'Social science subject',
    isCompulsory: true,
  },
  {
    name: 'Commerce',
    examTypeName: 'WAEC',
    description: 'Business studies subject',
    isCompulsory: false,
  },
  {
    name: 'Accounting',
    examTypeName: 'WAEC',
    description: 'Business and finance subject',
    isCompulsory: false,
  },
  {
    name: 'Government',
    examTypeName: 'WAEC',
    description: 'Political and civic education',
    isCompulsory: false,
  },
  {
    name: 'Literature in English',
    examTypeName: 'WAEC',
    description: 'English literature and criticism',
    isCompulsory: false,
  },
  {
    name: 'Agricultural Science',
    examTypeName: 'WAEC',
    description: 'Farming and agricultural practices',
    isCompulsory: false,
  },
  {
    name: 'Civic Education',
    examTypeName: 'WAEC',
    description: 'Citizenship and social responsibility',
    isCompulsory: true,
  },
  {
    name: 'Christian Religious Studies',
    examTypeName: 'WAEC',
    description: 'Christian theology and ethics',
    isCompulsory: false,
  },
  {
    name: 'Islamic Studies',
    examTypeName: 'WAEC',
    description: 'Islamic theology and practices',
    isCompulsory: false,
  },
  {
    name: 'Yoruba',
    examTypeName: 'WAEC',
    description: 'Yoruba language and culture',
    isCompulsory: false,
  },
  {
    name: 'Igbo',
    examTypeName: 'WAEC',
    description: 'Igbo language and culture',
    isCompulsory: false,
  },
  {
    name: 'Hausa',
    examTypeName: 'WAEC',
    description: 'Hausa language and culture',
    isCompulsory: false,
  },
  {
    name: 'Fine Arts',
    examTypeName: 'WAEC',
    description: 'Visual arts and design',
    isCompulsory: false,
  },
  {
    name: 'Music',
    examTypeName: 'WAEC',
    description: 'Music theory and performance',
    isCompulsory: false,
  },
  {
    name: 'Technical Drawing',
    examTypeName: 'WAEC',
    description: 'Engineering and architectural drawing',
    isCompulsory: false,
  },
  {
    name: 'Food and Nutrition',
    examTypeName: 'WAEC',
    description: 'Dietetics and food science',
    isCompulsory: false,
  },

  // ── NECO Subjects ────────────────────────────────────────────────────────────
  // Removed: Further Mathematics, French, Computer Studies, Geography
  {
    name: 'English Language',
    examTypeName: 'NECO',
    description: 'Compulsory core subject',
    isCompulsory: true,
  },
  {
    name: 'Mathematics',
    examTypeName: 'NECO',
    description: 'Compulsory core subject',
    isCompulsory: true,
  },
  {
    name: 'Physics',
    examTypeName: 'NECO',
    description: 'Science elective',
    isCompulsory: false,
  },
  {
    name: 'Chemistry',
    examTypeName: 'NECO',
    description: 'Science elective',
    isCompulsory: false,
  },
  {
    name: 'Biology',
    examTypeName: 'NECO',
    description: 'Science elective',
    isCompulsory: true,
  },
  {
    name: 'Economics',
    examTypeName: 'NECO',
    description: 'Social science subject',
    isCompulsory: true,
  },
  {
    name: 'Commerce',
    examTypeName: 'NECO',
    description: 'Business studies',
    isCompulsory: false,
  },
  {
    name: 'Accounting',
    examTypeName: 'NECO',
    description: 'Financial accounting',
    isCompulsory: false,
  },
  {
    name: 'Government',
    examTypeName: 'NECO',
    description: 'Civics and government',
    isCompulsory: false,
  },
  {
    name: 'Literature in English',
    examTypeName: 'NECO',
    description: 'English literature',
    isCompulsory: false,
  },
  {
    name: 'Agricultural Science',
    examTypeName: 'NECO',
    description: 'Agriculture and farming',
    isCompulsory: false,
  },
  {
    name: 'Civic Education',
    examTypeName: 'NECO',
    description: 'Citizenship education',
    isCompulsory: true,
  },
  {
    name: 'Christian Religious Studies',
    examTypeName: 'NECO',
    description: 'Christian studies',
    isCompulsory: false,
  },
  {
    name: 'Islamic Studies',
    examTypeName: 'NECO',
    description: 'Islamic studies',
    isCompulsory: false,
  },
  {
    name: 'Yoruba',
    examTypeName: 'NECO',
    description: 'Yoruba language',
    isCompulsory: false,
  },
  {
    name: 'Igbo',
    examTypeName: 'NECO',
    description: 'Igbo language',
    isCompulsory: false,
  },
  {
    name: 'Hausa',
    examTypeName: 'NECO',
    description: 'Hausa language',
    isCompulsory: false,
  },

  // ── POST-JAMB Subjects ───────────────────────────────────────────────────────
  {
    name: 'English Language',
    examTypeName: 'POST-JAMB',
    description: 'Compulsory subject',
    isCompulsory: false,
  },
  {
    name: 'Mathematics',
    examTypeName: 'POST-JAMB',
    description: 'Core subject',
    isCompulsory: false,
  },
  {
    name: 'Physics',
    examTypeName: 'POST-JAMB',
    description: 'Science subject',
    isCompulsory: false,
  },
  {
    name: 'Chemistry',
    examTypeName: 'POST-JAMB',
    description: 'Science subject',
    isCompulsory: false,
  },
  {
    name: 'Biology',
    examTypeName: 'POST-JAMB',
    description: 'Life sciences',
    isCompulsory: false,
  },
  {
    name: 'Economics',
    examTypeName: 'POST-JAMB',
    description: 'Social sciences',
    isCompulsory: false,
  },
  {
    name: 'Government',
    examTypeName: 'POST-JAMB',
    description: 'Political science',
    isCompulsory: false,
  },
  {
    name: 'Literature in English',
    examTypeName: 'POST-JAMB',
    description: 'Arts subject',
    isCompulsory: false,
  },
  {
    name: 'Commerce',
    examTypeName: 'POST-JAMB',
    description: 'Business subject',
    isCompulsory: false,
  },
  {
    name: 'Accounting',
    examTypeName: 'POST-JAMB',
    description: 'Finance subject',
    isCompulsory: false,
  },

  // ── GCE Subjects ─────────────────────────────────────────────────────────────
  // Removed: Further Mathematics, French, Computer Science, Geography, History
  {
    name: 'English Language',
    examTypeName: 'GCE',
    description: 'Compulsory subject',
    isCompulsory: true,
  },
  {
    name: 'Mathematics',
    examTypeName: 'GCE',
    description: 'Core subject',
    isCompulsory: true,
  },
  {
    name: 'Physics',
    examTypeName: 'GCE',
    description: 'Physical sciences',
    isCompulsory: false,
  },
  {
    name: 'Chemistry',
    examTypeName: 'GCE',
    description: 'Chemical sciences',
    isCompulsory: false,
  },
  {
    name: 'Biology',
    examTypeName: 'GCE',
    description: 'Life sciences',
    isCompulsory: true,
  },
  {
    name: 'Economics',
    examTypeName: 'GCE',
    description: 'Economics and business',
    isCompulsory: true,
  },
  {
    name: 'Accounting',
    examTypeName: 'GCE',
    description: 'Financial accounting',
    isCompulsory: false,
  },
  {
    name: 'Government',
    examTypeName: 'GCE',
    description: 'Government and politics',
    isCompulsory: false,
  },
  {
    name: 'Literature in English',
    examTypeName: 'GCE',
    description: 'English literature',
    isCompulsory: false,
  },
  {
    name: 'Civic Education',
    examTypeName: 'GCE',
    description: 'Citizenship education',
    isCompulsory: true,
  },

  // ── SAT Subjects ─────────────────────────────────────────────────────────────
  {
    name: 'Evidence-Based Reading and Writing',
    examTypeName: 'SAT',
    description: 'Critical reading and writing skills',
    isCompulsory: false,
  },
  {
    name: 'Mathematics',
    examTypeName: 'SAT',
    description: 'Algebra, geometry, and data analysis',
    isCompulsory: false,
  },
  {
    name: 'Essay (Optional)',
    examTypeName: 'SAT',
    description: 'Analytical writing assessment',
    isCompulsory: false,
  },
];
