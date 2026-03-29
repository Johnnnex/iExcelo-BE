import {
  QuestionCategory,
  QuestionDifficulty,
  QuestionType,
} from '../../../types';

/**
 * Core seed questions — 4-5 unique per ExamTypeSubject, rich content (LaTeX + Markdown).
 *
 * These are amplified ×20 by seedDummyQuestions() to give each ETS ~100 questions
 * for algorithm and rich-text stress testing.
 *
 * All text: Markdown + LaTeX inline ($...$) and block ($$...$$).
 * Images: ![alt](url) — using real Cloudinary demo URLs for dev.
 */

export interface QuestionSeed {
  examTypeName: string;
  subjectName: string;
  category: QuestionCategory;
  questionText: string;
  type: QuestionType;
  options?: Array<{ id: string; text: string; isCorrect: boolean }>;
  correctAnswer?: any;
  topicName?: string; // matched to a Topic entity by name+subjectName during seeding
  explanationShort?: string;
  explanationLong?: string;
  validationConfig?: any;
  difficulty: QuestionDifficulty;
  marks: number;
  passageSeed?: PassageSeed;
}

export interface PassageSeed {
  title: string;
  content: string;
}

export const questionsSeedData: QuestionSeed[] = [
  // ══════════════════════════════════════════════════════════════════════════
  // JAMB — Mathematics
  // ══════════════════════════════════════════════════════════════════════════

  {
    examTypeName: 'JAMB',
    subjectName: 'Mathematics',
    category: QuestionCategory.OBJECTIVES,
    questionText:
      'Differentiate $f(x) = x^3 - 4x^2 + 7x - 2$ with respect to $x$.',
    type: QuestionType.MULTIPLE_CHOICE,
    options: [
      { id: 'A', text: '$3x^2 - 8x + 7$', isCorrect: true },
      { id: 'B', text: '$3x^2 - 4x + 7$', isCorrect: false },
      { id: 'C', text: '$x^2 - 8x + 7$', isCorrect: false },
      { id: 'D', text: '$3x^2 + 8x - 7$', isCorrect: false },
    ],
    correctAnswer: 'A',
    topicName: 'Differentiation',
    explanationShort:
      'Apply the power rule $\\frac{d}{dx}(x^n)=nx^{n-1}$ term by term.',
    explanationLong:
      '$$\\frac{d}{dx}(x^3)=3x^2 \\quad \\frac{d}{dx}(-4x^2)=-8x \\quad \\frac{d}{dx}(7x)=7 \\quad \\frac{d}{dx}(-2)=0$$\n\n' +
      "Combining: $f'(x)=3x^2-8x+7$",
    difficulty: QuestionDifficulty.MEDIUM,
    marks: 1,
  },

  {
    examTypeName: 'JAMB',
    subjectName: 'Mathematics',
    category: QuestionCategory.OBJECTIVES,
    questionText: 'Evaluate $\\displaystyle\\int_0^1 (3x^2 + 2x)\\,dx$.',
    type: QuestionType.MULTIPLE_CHOICE,
    options: [
      { id: 'A', text: '$1$', isCorrect: false },
      { id: 'B', text: '$2$', isCorrect: true },
      { id: 'C', text: '$3$', isCorrect: false },
      { id: 'D', text: '$\\frac{5}{2}$', isCorrect: false },
    ],
    correctAnswer: 'B',
    topicName: 'Definite Integration',
    explanationShort: '$\\int_0^1(3x^2+2x)\\,dx=[x^3+x^2]_0^1=(1+1)-0=2$',
    explanationLong:
      'Integrate term by term:\n\n$$\\int 3x^2\\,dx=x^3,\\quad\\int 2x\\,dx=x^2$$\n\n' +
      '$$\\Big[x^3+x^2\\Big]_0^1=(1+1)-(0+0)=\\boxed{2}$$',
    difficulty: QuestionDifficulty.HARD,
    marks: 2,
  },

  {
    examTypeName: 'JAMB',
    subjectName: 'Mathematics',
    category: QuestionCategory.OBJECTIVES,
    questionText: 'Solve the quadratic equation $2x^2 - 5x + 3 = 0$.',
    type: QuestionType.MULTIPLE_CHOICE,
    options: [
      { id: 'A', text: '$x=\\frac{3}{2}$ or $x=1$', isCorrect: true },
      { id: 'B', text: '$x=-\\frac{3}{2}$ or $x=-1$', isCorrect: false },
      { id: 'C', text: '$x=3$ or $x=\\frac{1}{2}$', isCorrect: false },
      { id: 'D', text: '$x=\\frac{5}{2}$ or $x=-3$', isCorrect: false },
    ],
    correctAnswer: 'A',
    topicName: 'Quadratic Equations',
    explanationShort:
      'Factor: $(2x-3)(x-1)=0 \\Rightarrow x=\\tfrac{3}{2}$ or $x=1$.',
    explanationLong:
      'Find two numbers whose product is $2\\times3=6$ and sum is $-5$: these are $-2$ and $-3$.\n\n' +
      '$$2x^2-5x+3=2x^2-2x-3x+3=2x(x-1)-3(x-1)=(2x-3)(x-1)$$\n\n' +
      'Setting each factor to zero: $x=\\tfrac{3}{2}$ or $x=1$.',
    difficulty: QuestionDifficulty.MEDIUM,
    marks: 1,
  },

  {
    examTypeName: 'JAMB',
    subjectName: 'Mathematics',
    category: QuestionCategory.OBJECTIVES,
    questionText:
      'If $\\log_2 x + \\log_2 4 = \\log_2 20$, find the value of $x$.',
    type: QuestionType.MULTIPLE_CHOICE,
    options: [
      { id: 'A', text: '$3$', isCorrect: false },
      { id: 'B', text: '$5$', isCorrect: true },
      { id: 'C', text: '$8$', isCorrect: false },
      { id: 'D', text: '$10$', isCorrect: false },
    ],
    correctAnswer: 'B',
    topicName: 'Logarithms',
    explanationShort:
      '$\\log_2(4x)=\\log_2 20\\Rightarrow 4x=20\\Rightarrow x=5$.',
    explanationLong:
      'Using the log product rule $\\log_b m+\\log_b n=\\log_b(mn)$:\n\n' +
      '$$\\log_2(4x)=\\log_2 20\\Rightarrow 4x=20\\Rightarrow x=\\boxed{5}$$',
    difficulty: QuestionDifficulty.MEDIUM,
    marks: 1,
  },

  {
    examTypeName: 'JAMB',
    subjectName: 'Mathematics',
    category: QuestionCategory.OBJECTIVES,
    questionText:
      'The 10th term of an arithmetic progression is 37 and the first term is 1. What is the common difference?',
    type: QuestionType.MULTIPLE_CHOICE,
    options: [
      { id: 'A', text: '$3$', isCorrect: false },
      { id: 'B', text: '$4$', isCorrect: true },
      { id: 'C', text: '$5$', isCorrect: false },
      { id: 'D', text: '$6$', isCorrect: false },
    ],
    correctAnswer: 'B',
    topicName: 'Arithmetic Progressions',
    explanationShort: '$T_n=a+(n-1)d\\Rightarrow 37=1+9d\\Rightarrow d=4$.',
    explanationLong:
      'For an AP, $T_n=a+(n-1)d$.\n\nSubstituting $n=10$, $T_{10}=37$, $a=1$:\n\n' +
      '$$37=1+(10-1)d\\Rightarrow 36=9d\\Rightarrow d=\\boxed{4}$$',
    difficulty: QuestionDifficulty.EASY,
    marks: 1,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // JAMB — Physics
  // ══════════════════════════════════════════════════════════════════════════

  {
    examTypeName: 'JAMB',
    subjectName: 'Physics',
    category: QuestionCategory.OBJECTIVES,
    questionText:
      'A body of mass $m = 5\\,\\text{kg}$ is acted on by a net force. ' +
      "Using Newton's second law $F = ma$, if the acceleration $a = 3\\,\\text{m/s}^2$, what is $F$?\n\n" +
      '![Force diagram showing 5 kg block on a frictionless surface with arrow indicating 3 m/s² acceleration]' +
      '(https://res.cloudinary.com/dsmjskppp/image/upload/main-sample.png)',
    type: QuestionType.MULTIPLE_CHOICE,
    options: [
      { id: 'A', text: '$10\\,\\text{N}$', isCorrect: false },
      { id: 'B', text: '$15\\,\\text{N}$', isCorrect: true },
      { id: 'C', text: '$20\\,\\text{N}$', isCorrect: false },
      { id: 'D', text: '$8\\,\\text{N}$', isCorrect: false },
    ],
    correctAnswer: 'B',
    topicName: "Newton's Laws of Motion",
    explanationShort: '$F=ma=5\\times3=15\\,\\text{N}$',
    explanationLong:
      "Newton's second law states $F=ma$.\n\nSubstituting values:\n\n" +
      '$$F=5\\,\\text{kg}\\times3\\,\\text{m/s}^2=\\boxed{15\\,\\text{N}}$$\n\n' +
      'SI unit of force is the Newton: $1\\,\\text{N}=1\\,\\text{kg}\\cdot\\text{m/s}^2$.',
    difficulty: QuestionDifficulty.EASY,
    marks: 1,
  },

  {
    examTypeName: 'JAMB',
    subjectName: 'Physics',
    category: QuestionCategory.OBJECTIVES,
    questionText:
      'A wave has frequency $f = 500\\,\\text{Hz}$ and wavelength $\\lambda = 0.68\\,\\text{m}$. What is its speed?',
    type: QuestionType.MULTIPLE_CHOICE,
    options: [
      { id: 'A', text: '$340\\,\\text{m/s}$', isCorrect: true },
      { id: 'B', text: '$500\\,\\text{m/s}$', isCorrect: false },
      { id: 'C', text: '$170\\,\\text{m/s}$', isCorrect: false },
      { id: 'D', text: '$680\\,\\text{m/s}$', isCorrect: false },
    ],
    correctAnswer: 'A',
    topicName: 'Wave Motion',
    explanationShort: '$v=f\\lambda=500\\times0.68=340\\,\\text{m/s}$',
    explanationLong:
      'The wave equation is $v=f\\lambda$.\n\n' +
      '$$v=500\\,\\text{Hz}\\times0.68\\,\\text{m}=\\boxed{340\\,\\text{m/s}}$$\n\n' +
      'This is approximately the speed of sound in air at room temperature.',
    difficulty: QuestionDifficulty.EASY,
    marks: 1,
  },

  {
    examTypeName: 'JAMB',
    subjectName: 'Physics',
    category: QuestionCategory.OBJECTIVES,
    questionText:
      'A gas at pressure $P_1=200\\,\\text{kPa}$ and volume $V_1=5\\,\\text{L}$ is compressed at ' +
      'constant temperature until $V_2=2\\,\\text{L}$. What is $P_2$?',
    type: QuestionType.MULTIPLE_CHOICE,
    options: [
      { id: 'A', text: '$400\\,\\text{kPa}$', isCorrect: false },
      { id: 'B', text: '$500\\,\\text{kPa}$', isCorrect: true },
      { id: 'C', text: '$250\\,\\text{kPa}$', isCorrect: false },
      { id: 'D', text: '$80\\,\\text{kPa}$', isCorrect: false },
    ],
    correctAnswer: 'B',
    topicName: 'Gas Laws',
    explanationShort:
      "Boyle's Law: $P_1V_1=P_2V_2\\Rightarrow P_2=\\frac{200\\times5}{2}=500\\,\\text{kPa}$",
    explanationLong:
      "At constant temperature, Boyle's Law states $P_1V_1=P_2V_2$.\n\n" +
      '$$P_2=\\frac{P_1V_1}{V_2}=\\frac{200\\times5}{2}=\\boxed{500\\,\\text{kPa}}$$\n\n' +
      'Pressure increases as volume decreases — inverse relationship.',
    difficulty: QuestionDifficulty.MEDIUM,
    marks: 1,
  },

  {
    examTypeName: 'JAMB',
    subjectName: 'Physics',
    category: QuestionCategory.OBJECTIVES,
    questionText: 'Match each physical quantity with its correct SI unit.',
    type: QuestionType.MATCHING,
    options: [
      { id: 'Force', text: 'Force', isCorrect: false },
      { id: 'Energy', text: 'Energy', isCorrect: false },
      { id: 'Power', text: 'Power', isCorrect: false },
      { id: 'Pressure', text: 'Pressure', isCorrect: false },
    ],
    correctAnswer: {
      Force: 'Newton (N)',
      Energy: 'Joule (J)',
      Power: 'Watt (W)',
      Pressure: 'Pascal (Pa)',
    },
    validationConfig: { allowPartialCredit: true },
    topicName: 'SI Units and Physical Quantities',
    explanationShort: 'Force→N, Energy→J, Power→W, Pressure→Pa.',
    explanationLong:
      '| Quantity | SI Unit | Symbol |\n|----------|---------|--------|\n' +
      '| Force | Newton | N |\n| Energy | Joule | J |\n' +
      '| Power | Watt | W |\n| Pressure | Pascal | Pa |\n\n' +
      'All derived from base SI units: kg, m, s.',
    difficulty: QuestionDifficulty.MEDIUM,
    marks: 4,
  },

  {
    examTypeName: 'JAMB',
    subjectName: 'Physics',
    category: QuestionCategory.OBJECTIVES,
    questionText:
      'Two resistors of $6\\,\\Omega$ and $3\\,\\Omega$ are connected in **parallel**. ' +
      'What is the equivalent resistance?',
    type: QuestionType.MULTIPLE_CHOICE,
    options: [
      { id: 'A', text: '$9\\,\\Omega$', isCorrect: false },
      { id: 'B', text: '$4.5\\,\\Omega$', isCorrect: false },
      { id: 'C', text: '$2\\,\\Omega$', isCorrect: true },
      { id: 'D', text: '$18\\,\\Omega$', isCorrect: false },
    ],
    correctAnswer: 'C',
    topicName: 'Electric Circuits',
    explanationShort:
      '$\\frac{1}{R}=\\frac{1}{6}+\\frac{1}{3}=\\frac{1}{2}\\Rightarrow R=2\\,\\Omega$',
    explanationLong:
      'For resistors in parallel:\n\n' +
      '$$\\frac{1}{R_{eq}}=\\frac{1}{R_1}+\\frac{1}{R_2}=\\frac{1}{6}+\\frac{1}{3}=\\frac{1+2}{6}=\\frac{3}{6}=\\frac{1}{2}$$\n\n' +
      '$$R_{eq}=\\boxed{2\\,\\Omega}$$\n\nAlternatively: $R_{eq}=\\frac{R_1R_2}{R_1+R_2}=\\frac{18}{9}=2\\,\\Omega$.',
    difficulty: QuestionDifficulty.MEDIUM,
    marks: 1,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // JAMB — Chemistry
  // ══════════════════════════════════════════════════════════════════════════

  {
    examTypeName: 'JAMB',
    subjectName: 'Chemistry',
    category: QuestionCategory.OBJECTIVES,
    questionText:
      'Which of the following correctly represents the **empirical formula** of a compound ' +
      'containing 40% Carbon, 6.7% Hydrogen, and 53.3% Oxygen by mass?\n\n' +
      '*(Relative atomic masses: C = 12, H = 1, O = 16)*',
    type: QuestionType.MULTIPLE_CHOICE,
    options: [
      { id: 'A', text: '$\\text{CH}_2\\text{O}$', isCorrect: true },
      {
        id: 'B',
        text: '$\\text{C}_2\\text{H}_4\\text{O}_2$',
        isCorrect: false,
      },
      { id: 'C', text: '$\\text{CHO}$', isCorrect: false },
      { id: 'D', text: '$\\text{C}_2\\text{H}_2\\text{O}$', isCorrect: false },
    ],
    correctAnswer: 'A',
    topicName: 'Empirical and Molecular Formulae',
    explanationShort:
      'Divide each % by atomic mass: C≈3.33, H=6.7, O≈3.33. Ratio 1:2:1 → **CH₂O**.',
    explanationLong:
      '**Step 1** — Divide mass% by atomic mass:\n' +
      '$$\\text{C}:\\frac{40}{12}=3.33,\\quad\\text{H}:\\frac{6.7}{1}=6.7,\\quad\\text{O}:\\frac{53.3}{16}=3.33$$\n\n' +
      '**Step 2** — Divide by smallest (3.33):\n$$\\text{C}:1,\\quad\\text{H}:2,\\quad\\text{O}:1$$\n\n' +
      '**Empirical formula:** $\\text{CH}_2\\text{O}$ — also the repeating unit of glucose.',
    difficulty: QuestionDifficulty.HARD,
    marks: 2,
  },

  {
    examTypeName: 'JAMB',
    subjectName: 'Chemistry',
    category: QuestionCategory.OBJECTIVES,
    questionText:
      'Fill in the blank: The process by which a solid changes directly to a gas ' +
      'without passing through the liquid phase is called ___________.',
    type: QuestionType.FILL_IN_THE_BLANK,
    correctAnswer: 'sublimation',
    validationConfig: { caseSensitive: false },
    topicName: 'States of Matter and Phase Changes',
    explanationShort:
      '**Sublimation** — e.g. dry ice ($\\text{CO}_2$) sublimes at room temperature.',
    explanationLong:
      '**Sublimation** is the endothermic phase transition from solid directly to gas.\n\n' +
      'Examples:\n- Dry ice ($\\text{CO}_2$) at room temperature\n' +
      '- Iodine crystals when gently heated\n- Naphthalene (mothballs)\n\n' +
      'The reverse (gas → solid directly) is **deposition**.',
    difficulty: QuestionDifficulty.MEDIUM,
    marks: 1,
  },

  {
    examTypeName: 'JAMB',
    subjectName: 'Chemistry',
    category: QuestionCategory.OBJECTIVES,
    questionText:
      'In the reaction $2\\text{Fe} + \\text{O}_2 \\rightarrow 2\\text{FeO}$, which species is the **oxidising agent**?',
    type: QuestionType.MULTIPLE_CHOICE,
    options: [
      { id: 'A', text: 'Iron ($\\text{Fe}$)', isCorrect: false },
      { id: 'B', text: 'Oxygen ($\\text{O}_2$)', isCorrect: true },
      { id: 'C', text: 'Iron oxide ($\\text{FeO}$)', isCorrect: false },
      { id: 'D', text: 'Both Fe and O₂', isCorrect: false },
    ],
    correctAnswer: 'B',
    topicName: 'Redox Reactions',
    explanationShort:
      '$\\text{O}_2$ gains electrons (is reduced), so it is the oxidising agent; Fe loses electrons (is oxidised).',
    explanationLong:
      'In redox reactions:\n- **Oxidising agent** = gains electrons (is itself reduced)\n' +
      '- **Reducing agent** = loses electrons (is itself oxidised)\n\n' +
      'Here: Fe → Fe²⁺ + 2e⁻ (Fe is oxidised — **reducing agent**)\n\n' +
      '$\\text{O}_2$ + 4e⁻ → 2O²⁻ ($\\text{O}_2$ is reduced — **oxidising agent** ✓)',
    difficulty: QuestionDifficulty.MEDIUM,
    marks: 1,
  },

  {
    examTypeName: 'JAMB',
    subjectName: 'Chemistry',
    category: QuestionCategory.OBJECTIVES,
    questionText:
      'Select **all** the products formed during the electrolysis of **dilute sulphuric acid** ($\\text{H}_2\\text{SO}_4$) using inert electrodes.',
    type: QuestionType.MULTIPLE_RESPONSE,
    options: [
      {
        id: 'A',
        text: 'Hydrogen gas ($\\text{H}_2$) at cathode',
        isCorrect: true,
      },
      { id: 'B', text: 'Oxygen gas ($\\text{O}_2$) at anode', isCorrect: true },
      { id: 'C', text: 'Sulphur dioxide ($\\text{SO}_2$)', isCorrect: false },
      { id: 'D', text: 'The acid becomes more concentrated', isCorrect: true },
    ],
    correctAnswer: ['A', 'B', 'D'],
    topicName: 'Electrolysis',
    explanationShort:
      'Cathode: 2H⁺ + 2e⁻ → H₂. Anode: 2H₂O → O₂ + 4H⁺ + 4e⁻. Acid concentration increases.',
    explanationLong:
      'With dilute $\\text{H}_2\\text{SO}_4$ and inert electrodes:\n\n' +
      '**Cathode:** $2\\text{H}^+ + 2e^- \\rightarrow \\text{H}_2(g)$ ✓\n\n' +
      '**Anode:** $2\\text{H}_2\\text{O} \\rightarrow \\text{O}_2(g) + 4\\text{H}^+ + 4e^-$ ✓\n\n' +
      'Water is consumed and H⁺ ions are regenerated, so **the acid becomes more concentrated** ✓\n\n' +
      '$\\text{SO}_4^{2-}$ ions are not discharged — they remain in solution.',
    difficulty: QuestionDifficulty.HARD,
    marks: 3,
  },

  {
    examTypeName: 'JAMB',
    subjectName: 'Chemistry',
    category: QuestionCategory.OBJECTIVES,
    questionText:
      'Calculate the pH of a solution with hydrogen ion concentration $[\\text{H}^+] = 1\\times10^{-4}\\,\\text{mol/dm}^3$.',
    type: QuestionType.MULTIPLE_CHOICE,
    options: [
      { id: 'A', text: '2', isCorrect: false },
      { id: 'B', text: '4', isCorrect: true },
      { id: 'C', text: '6', isCorrect: false },
      { id: 'D', text: '10', isCorrect: false },
    ],
    correctAnswer: 'B',
    topicName: 'Acids, Bases and pH',
    explanationShort:
      '$\\text{pH}=-\\log_{10}[\\text{H}^+]=-\\log_{10}(10^{-4})=4$',
    explanationLong:
      '$$\\text{pH}=-\\log_{10}[\\text{H}^+]$$\n\n' +
      '$$=-\\log_{10}(1\\times10^{-4})=-(-4)=\\boxed{4}$$\n\n' +
      'Since pH = 4 < 7, the solution is **acidic**.',
    difficulty: QuestionDifficulty.EASY,
    marks: 1,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // JAMB — Biology
  // ══════════════════════════════════════════════════════════════════════════

  {
    examTypeName: 'JAMB',
    subjectName: 'Biology',
    category: QuestionCategory.OBJECTIVES,
    questionText:
      'Select **all** structures found in a plant cell but **NOT** in an animal cell.',
    type: QuestionType.MULTIPLE_RESPONSE,
    options: [
      { id: 'A', text: 'Cell wall', isCorrect: true },
      { id: 'B', text: 'Chloroplast', isCorrect: true },
      { id: 'C', text: 'Mitochondria', isCorrect: false },
      { id: 'D', text: 'Large central vacuole', isCorrect: true },
    ],
    correctAnswer: ['A', 'B', 'D'],
    topicName: 'Cell Structure and Organisation',
    explanationShort:
      'Cell wall, chloroplasts, and large central vacuoles are exclusive to plant cells.',
    explanationLong:
      '| Structure | Plant Cell | Animal Cell |\n|-----------|-----------|-------------|\n' +
      '| Cell wall | ✅ | ❌ |\n| Chloroplast | ✅ | ❌ |\n' +
      '| Large central vacuole | ✅ | ❌ (only small vesicles) |\n' +
      '| Mitochondria | ✅ | ✅ |\n\n' +
      'Mitochondria are present in **both** cell types, making C incorrect.',
    difficulty: QuestionDifficulty.MEDIUM,
    marks: 3,
  },

  {
    examTypeName: 'JAMB',
    subjectName: 'Biology',
    category: QuestionCategory.OBJECTIVES,
    questionText:
      'The overall equation for **photosynthesis** is:\n\n' +
      '![Diagram of a green leaf absorbing sunlight and CO₂, releasing O₂]' +
      '(https://res.cloudinary.com/dsmjskppp/image/upload/main-sample.png)\n\n' +
      'Which of the following correctly represents this process?',
    type: QuestionType.MULTIPLE_CHOICE,
    options: [
      {
        id: 'A',
        text: '$6\\text{CO}_2 + 6\\text{H}_2\\text{O} \\xrightarrow{\\text{light}} \\text{C}_6\\text{H}_{12}\\text{O}_6 + 6\\text{O}_2$',
        isCorrect: true,
      },
      {
        id: 'B',
        text: '$\\text{C}_6\\text{H}_{12}\\text{O}_6 + 6\\text{O}_2 \\rightarrow 6\\text{CO}_2 + 6\\text{H}_2\\text{O}$',
        isCorrect: false,
      },
      {
        id: 'C',
        text: '$6\\text{CO}_2 + 6\\text{H}_2\\text{O} \\rightarrow \\text{C}_6\\text{H}_{12}\\text{O}_6 + 3\\text{O}_2$',
        isCorrect: false,
      },
      {
        id: 'D',
        text: '$\\text{C}_6\\text{H}_{12}\\text{O}_6 \\xrightarrow{\\text{light}} 6\\text{CO}_2 + 6\\text{H}_2\\text{O}$',
        isCorrect: false,
      },
    ],
    correctAnswer: 'A',
    topicName: 'Photosynthesis',
    explanationShort:
      '6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂ (in the presence of light and chlorophyll).',
    explanationLong:
      'Photosynthesis occurs in two stages:\n\n' +
      '**Light reactions** (thylakoids): $\\text{H}_2\\text{O}$ is split, $\\text{O}_2$ is released, ATP and NADPH are produced.\n\n' +
      '**Calvin cycle** (stroma): $\\text{CO}_2$ is fixed to produce glucose ($\\text{C}_6\\text{H}_{12}\\text{O}_6$).\n\n' +
      'Option B is **respiration** (the reverse). Option C has the wrong O₂ coefficient.',
    difficulty: QuestionDifficulty.EASY,
    marks: 1,
  },

  {
    examTypeName: 'JAMB',
    subjectName: 'Biology',
    category: QuestionCategory.OBJECTIVES,
    questionText:
      'In a monohybrid cross between two **heterozygous tall plants** (Tt × Tt), ' +
      'what is the expected ratio of tall to short plants in the offspring?',
    type: QuestionType.MULTIPLE_CHOICE,
    options: [
      { id: 'A', text: '1 : 1', isCorrect: false },
      { id: 'B', text: '2 : 1', isCorrect: false },
      { id: 'C', text: '3 : 1', isCorrect: true },
      { id: 'D', text: '4 : 0', isCorrect: false },
    ],
    correctAnswer: 'C',
    topicName: 'Mendelian Genetics and Inheritance',
    explanationShort:
      'Tt × Tt gives 1 TT : 2 Tt : 1 tt → phenotype ratio **3 tall : 1 short**.',
    explanationLong:
      'Using a Punnett square:\n\n```\n      T        t\n  T | TT  |  Tt |\n  t | Tt  |  tt |\n```\n\n' +
      'Genotypes: 1 TT (tall) : 2 Tt (tall) : 1 tt (short)\n\n' +
      '**Phenotype ratio: 3 tall : 1 short** since tall (T) is dominant over short (t).',
    difficulty: QuestionDifficulty.MEDIUM,
    marks: 1,
  },

  {
    examTypeName: 'JAMB',
    subjectName: 'Biology',
    category: QuestionCategory.OBJECTIVES,
    questionText:
      'The hormone responsible for the **"fight or flight"** response in humans is secreted by the:',
    type: QuestionType.MULTIPLE_CHOICE,
    options: [
      { id: 'A', text: 'Thyroid gland → Thyroxine', isCorrect: false },
      {
        id: 'B',
        text: 'Adrenal medulla → Adrenaline (Epinephrine)',
        isCorrect: true,
      },
      { id: 'C', text: 'Pancreas → Insulin', isCorrect: false },
      { id: 'D', text: 'Pituitary gland → ADH', isCorrect: false },
    ],
    correctAnswer: 'B',
    topicName: 'Hormones and the Endocrine System',
    explanationShort:
      'Adrenaline (epinephrine), from the adrenal medulla, triggers the fight-or-flight response.',
    explanationLong:
      '**Adrenaline** (epinephrine) is released by the **adrenal medulla** in response to stress. Its effects:\n\n' +
      '- ↑ Heart rate and blood pressure\n- Dilation of bronchioles (more O₂ to muscles)\n' +
      '- Pupil dilation\n- ↑ Blood glucose (via glycogen breakdown)\n' +
      '- Blood redirected to skeletal muscles\n\n' +
      'This prepares the body for rapid physical action.',
    difficulty: QuestionDifficulty.EASY,
    marks: 1,
  },

  {
    examTypeName: 'JAMB',
    subjectName: 'Biology',
    category: QuestionCategory.OBJECTIVES,
    questionText: 'Which of the following **correctly describes osmosis**?',
    type: QuestionType.MULTIPLE_CHOICE,
    options: [
      {
        id: 'A',
        text: 'Movement of solute molecules from high to low concentration across a semi-permeable membrane',
        isCorrect: false,
      },
      {
        id: 'B',
        text: 'Movement of water molecules from a region of high water potential to low water potential across a semi-permeable membrane',
        isCorrect: true,
      },
      {
        id: 'C',
        text: 'Movement of molecules against a concentration gradient using energy',
        isCorrect: false,
      },
      {
        id: 'D',
        text: 'Movement of all molecules equally through a semi-permeable membrane',
        isCorrect: false,
      },
    ],
    correctAnswer: 'B',
    topicName: 'Osmosis and Diffusion',
    explanationShort:
      'Osmosis = water movement across a semi-permeable membrane from high to low water potential (dilute to concentrated solution).',
    explanationLong:
      '**Osmosis** is a special type of diffusion involving only water molecules:\n\n' +
      '- Moves across a **semi-permeable membrane** (allows water but not solutes)\n' +
      '- Direction: high water potential → low water potential\n' +
      '- Equivalent: dilute solution → concentrated solution\n\n' +
      'No energy is required (passive process). Compare:\n' +
      '- **Diffusion**: any molecules, no membrane required\n' +
      '- **Active transport**: against gradient, requires ATP',
    difficulty: QuestionDifficulty.MEDIUM,
    marks: 1,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // JAMB — English Language (with a passage)
  // ══════════════════════════════════════════════════════════════════════════

  {
    examTypeName: 'JAMB',
    subjectName: 'English Language',
    category: QuestionCategory.OBJECTIVES,
    questionText: 'What is the **main theme** of the passage?',
    type: QuestionType.MULTIPLE_CHOICE,
    options: [
      {
        id: 'A',
        text: 'The destruction caused by industrialisation',
        isCorrect: false,
      },
      {
        id: 'B',
        text: 'The resilience of nature in the face of human activity',
        isCorrect: true,
      },
      {
        id: 'C',
        text: 'The economic benefits of deforestation',
        isCorrect: false,
      },
      {
        id: 'D',
        text: 'The relationship between rainfall and agriculture',
        isCorrect: false,
      },
    ],
    correctAnswer: 'B',
    topicName: 'Reading Comprehension and Main Idea',
    explanationShort:
      'The passage emphasises how forests regrow and ecosystems recover despite human interference.',
    explanationLong:
      'The author uses imagery of regrowth — seedlings emerging from ash, rivers running clear — ' +
      'to argue that **nature is resilient**.\n\nWhile industrialisation is the backdrop, ' +
      "nature's tenacity is the central celebration, making **B** the main theme.",
    difficulty: QuestionDifficulty.MEDIUM,
    marks: 1,
    passageSeed: {
      title: 'The Resilience of Nature',
      content:
        'The forest stood silent in the aftermath of decades of logging. Where once great trees had towered, ' +
        'only stumps and tangled undergrowth remained. Yet, barely a generation later, the land had transformed again. ' +
        'Seedlings pushed through the ashen soil; creepers draped themselves over the skeletal frames of fallen giants. ' +
        'Rivers, once choked with silt, ran clear once more.\n\n' +
        'Scientists who had documented the destruction now returned to catalogue the recovery. ' +
        'Their findings confounded those who believed the damage to be permanent. ' +
        'Nature, it seemed, was far more **resilient** than human ambition had accounted for. ' +
        'The forest was returning, on its own terms and in its own time.',
    },
  },

  {
    examTypeName: 'JAMB',
    subjectName: 'English Language',
    category: QuestionCategory.OBJECTIVES,
    questionText:
      'Which word is the closest in meaning to **"resilient"** as used in the passage?',
    type: QuestionType.MULTIPLE_CHOICE,
    options: [
      { id: 'A', text: 'Fragile', isCorrect: false },
      { id: 'B', text: 'Adaptable and recovering', isCorrect: true },
      { id: 'C', text: 'Aggressive', isCorrect: false },
      { id: 'D', text: 'Stagnant', isCorrect: false },
    ],
    correctAnswer: 'B',
    topicName: 'Vocabulary in Context',
    explanationShort:
      '"Resilient" means able to recover quickly from difficulties — **adaptable and recovering**.',
    explanationLong:
      'In context, "resilient" describes nature\'s ability to **bounce back** from logging and human destruction.\n\n' +
      '- Fragile (A) is the opposite\n- Aggressive (C) does not fit — recovery is gradual, not forceful\n' +
      '- Stagnant (D) means unchanging — the opposite of recovery\n\n**B** captures the meaning precisely.',
    difficulty: QuestionDifficulty.EASY,
    marks: 1,
    passageSeed: {
      title: 'The Resilience of Nature',
      content:
        'The forest stood silent in the aftermath of decades of logging. Where once great trees had towered, ' +
        'only stumps and tangled undergrowth remained. Yet, barely a generation later, the land had transformed again. ' +
        'Seedlings pushed through the ashen soil; creepers draped themselves over the skeletal frames of fallen giants. ' +
        'Rivers, once choked with silt, ran clear once more.\n\n' +
        'Scientists who had documented the destruction now returned to catalogue the recovery. ' +
        'Their findings confounded those who believed the damage to be permanent. ' +
        'Nature, it seemed, was far more **resilient** than human ambition had accounted for. ' +
        'The forest was returning, on its own terms and in its own time.',
    },
  },

  {
    examTypeName: 'JAMB',
    subjectName: 'English Language',
    category: QuestionCategory.OBJECTIVES,
    questionText:
      'Choose the sentence where the **pronoun** is used correctly:\n\n' +
      '*(i) Between you and I, the result was unexpected.*\n' +
      '*(ii) It is I who should apologise.*\n' +
      '*(iii) The manager praised both she and him.*\n' +
      '*(iv) Between you and me, the result was unexpected.*',
    type: QuestionType.MULTIPLE_CHOICE,
    options: [
      { id: 'A', text: '(i) and (ii)', isCorrect: false },
      { id: 'B', text: '(ii) and (iv)', isCorrect: true },
      { id: 'C', text: '(iii) and (iv)', isCorrect: false },
      { id: 'D', text: '(i) only', isCorrect: false },
    ],
    correctAnswer: 'B',
    topicName: 'Pronoun Usage and Case',
    explanationShort:
      '"Between you and *me*" (object of preposition) and "It is *I*" (subject complement) are both correct.',
    explanationLong:
      '**Pronouns after prepositions** take the **objective case**: "between you and **me**" (not *I*).\n\n' +
      '**Subject complements** after "to be" take the **subjective case**: "It is **I**" (formal/correct).\n\n' +
      '- (i) ❌ — "between you and *I*" should be "between you and *me*"\n' +
      '- (ii) ✅ — "It is *I*" — correct subject complement\n' +
      '- (iii) ❌ — should be "both *her* and him"\n' +
      '- (iv) ✅ — correct objective case after preposition',
    difficulty: QuestionDifficulty.HARD,
    marks: 1,
  },

  {
    examTypeName: 'JAMB',
    subjectName: 'English Language',
    category: QuestionCategory.OBJECTIVES,
    questionText:
      '"The teacher said, \'I *am* happy with your progress.\'" What is the correct **indirect speech**?',
    type: QuestionType.MULTIPLE_CHOICE,
    options: [
      {
        id: 'A',
        text: 'The teacher said that he was happy with our progress.',
        isCorrect: true,
      },
      {
        id: 'B',
        text: 'The teacher said that he is happy with your progress.',
        isCorrect: false,
      },
      {
        id: 'C',
        text: 'The teacher told that he was happy with your progress.',
        isCorrect: false,
      },
      {
        id: 'D',
        text: 'The teacher said he will be happy with your progress.',
        isCorrect: false,
      },
    ],
    correctAnswer: 'A',
    topicName: 'Direct and Indirect Speech',
    explanationShort:
      'Present "am" → past "was"; "I" → "he"; "your" → "our" (speaker\'s perspective shifts).',
    explanationLong:
      'Rules for converting **direct to indirect speech**:\n\n' +
      '1. **Tense backshift**: "am" (present) → "was" (past)\n' +
      '2. **Pronoun shift**: "I" → "he/she" (the teacher)\n' +
      '3. **"your" → "our"** if the reporter is among the students addressed\n' +
      '4. Use **"said that"** (not "told that" — "told" requires an object)\n\n' +
      'Option A satisfies all four rules correctly.',
    difficulty: QuestionDifficulty.MEDIUM,
    marks: 1,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // JAMB — Agricultural Science
  // ══════════════════════════════════════════════════════════════════════════

  {
    examTypeName: 'JAMB',
    subjectName: 'Agricultural Science',
    category: QuestionCategory.OBJECTIVES,
    questionText:
      'A periodic maintenance activity carried out on a farm tractor is:\n\n' +
      '![Cross-section of a farm tractor engine]' +
      '(https://res.cloudinary.com/dsmjskppp/image/upload/main-sample.png)',
    type: QuestionType.MULTIPLE_CHOICE,
    options: [
      { id: 'A', text: 'Checking of radiator water', isCorrect: true },
      {
        id: 'B',
        text: 'Replacement of the entire exhaust system',
        isCorrect: false,
      },
      { id: 'C', text: 'Re-painting the chassis', isCorrect: false },
      { id: 'D', text: 'Replacing all tyres simultaneously', isCorrect: false },
    ],
    correctAnswer: 'A',
    topicName: 'Farm Machinery and Maintenance',
    explanationShort:
      'Checking radiator water prevents engine overheating — a standard periodic maintenance task.',
    explanationLong:
      'Farm tractor maintenance is classified as:\n\n' +
      '- **Daily**: Check oil level, radiator water, tyre pressure, fuel\n' +
      '- **Weekly**: Clean air filter, check battery terminals\n' +
      '- **Monthly**: Change engine oil, check brake fluid\n\n' +
      '"Periodic" refers to **scheduled** maintenance, not reactive repairs. ' +
      'Checking radiator water daily ensures the cooling system functions properly.',
    difficulty: QuestionDifficulty.EASY,
    marks: 1,
  },

  {
    examTypeName: 'JAMB',
    subjectName: 'Agricultural Science',
    category: QuestionCategory.OBJECTIVES,
    questionText:
      'Which of the following **soil types** has the best water retention AND good drainage, ' +
      'making it the most suitable for most crops?',
    type: QuestionType.MULTIPLE_CHOICE,
    options: [
      { id: 'A', text: 'Sandy soil', isCorrect: false },
      { id: 'B', text: 'Clay soil', isCorrect: false },
      { id: 'C', text: 'Loamy soil', isCorrect: true },
      { id: 'D', text: 'Silty soil', isCorrect: false },
    ],
    correctAnswer: 'C',
    topicName: 'Soil Types and Properties',
    explanationShort:
      'Loamy soil = ideal mix of sand, silt, and clay → balanced drainage and water retention.',
    explanationLong:
      '| Soil Type | Drainage | Water Retention | Crop Suitability |\n' +
      '|-----------|----------|-----------------|------------------|\n' +
      '| Sandy | Too fast | Poor | Low (nutrients leach) |\n' +
      '| Clay | Too slow | Excessive | Low (waterlogging) |\n' +
      '| **Loamy** | **Good** | **Good** | **Best** |\n' +
      '| Silty | Moderate | Moderate | Good (compacts easily) |\n\n' +
      'Loamy soil contains approximately 40% sand, 40% silt, and 20% clay.',
    difficulty: QuestionDifficulty.EASY,
    marks: 1,
  },

  {
    examTypeName: 'JAMB',
    subjectName: 'Agricultural Science',
    category: QuestionCategory.OBJECTIVES,
    questionText:
      'The process of growing different crops on the same piece of land in successive seasons is called:',
    type: QuestionType.MULTIPLE_CHOICE,
    options: [
      { id: 'A', text: 'Mixed farming', isCorrect: false },
      { id: 'B', text: 'Crop rotation', isCorrect: true },
      { id: 'C', text: 'Monoculture', isCorrect: false },
      { id: 'D', text: 'Intercropping', isCorrect: false },
    ],
    correctAnswer: 'B',
    topicName: 'Crop Production Systems',
    explanationShort:
      '**Crop rotation** = growing different crops in sequence on the same land across seasons.',
    explanationLong:
      'Benefits of **crop rotation**:\n\n' +
      '1. **Breaks pest/disease cycles** — pests specific to one crop starve in off-seasons\n' +
      '2. **Improves soil fertility** — legumes fix atmospheric nitrogen\n' +
      '3. **Reduces soil erosion** — continuous ground cover\n' +
      '4. **Controls weeds** — different crops suppress different weed types\n\n' +
      'Compare:\n- **Intercropping**: two crops grown simultaneously on the same plot\n' +
      '- **Monoculture**: same crop grown repeatedly (depletes soil, encourages pests)',
    difficulty: QuestionDifficulty.EASY,
    marks: 1,
  },

  {
    examTypeName: 'JAMB',
    subjectName: 'Agricultural Science',
    category: QuestionCategory.OBJECTIVES,
    questionText:
      'In the NPK fertilizer label **15:15:15**, what do the three numbers represent?',
    type: QuestionType.MULTIPLE_CHOICE,
    options: [
      {
        id: 'A',
        text: 'Nitrogen : Potassium : Phosphorus percentages',
        isCorrect: false,
      },
      {
        id: 'B',
        text: 'Nitrogen : Phosphorus (as P₂O₅) : Potassium (as K₂O) percentages',
        isCorrect: true,
      },
      {
        id: 'C',
        text: 'pH value : moisture : nutrient content',
        isCorrect: false,
      },
      {
        id: 'D',
        text: 'Amount (kg) of each element per bag',
        isCorrect: false,
      },
    ],
    correctAnswer: 'B',
    topicName: 'Fertilizers and Plant Nutrition',
    explanationShort:
      'NPK labels show % N : % P₂O₅ : % K₂O. 15:15:15 means equal proportions of each.',
    explanationLong:
      'The **NPK fertilizer rating** gives percentage composition by weight:\n\n' +
      '- **N** (Nitrogen) → promotes leafy/vegetative growth\n' +
      '- **P** (Phosphorus, expressed as $\\text{P}_2\\text{O}_5$) → promotes root and fruit development\n' +
      '- **K** (Potassium, expressed as $\\text{K}_2\\text{O}$) → overall plant health and disease resistance\n\n' +
      '**15:15:15** (balanced/compound) is suitable as a general-purpose fertilizer for most crops.',
    difficulty: QuestionDifficulty.MEDIUM,
    marks: 1,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // WAEC — Mathematics
  // ══════════════════════════════════════════════════════════════════════════

  {
    examTypeName: 'WAEC',
    subjectName: 'Mathematics',
    category: QuestionCategory.OBJECTIVES,
    questionText: 'Evaluate $\\log_{10}1000 - \\log_{10}10$.',
    type: QuestionType.MULTIPLE_CHOICE,
    options: [
      { id: 'A', text: '$1$', isCorrect: false },
      { id: 'B', text: '$2$', isCorrect: true },
      { id: 'C', text: '$3$', isCorrect: false },
      { id: 'D', text: '$\\frac{1}{3}$', isCorrect: false },
    ],
    correctAnswer: 'B',
    topicName: 'Logarithms',
    explanationShort: '$\\log_{10}1000-\\log_{10}10=3-1=2$',
    explanationLong:
      'Using the log quotient rule: $\\log_b m - \\log_b n = \\log_b\\!\\left(\\frac{m}{n}\\right)$\n\n' +
      '$$\\log_{10}1000-\\log_{10}10=\\log_{10}\\!\\left(\\frac{1000}{10}\\right)=\\log_{10}100=\\boxed{2}$$',
    difficulty: QuestionDifficulty.EASY,
    marks: 1,
  },

  {
    examTypeName: 'WAEC',
    subjectName: 'Mathematics',
    category: QuestionCategory.OBJECTIVES,
    questionText:
      'The midpoint of a line segment joining $A(2, 4)$ and $B(8, 10)$ is:',
    type: QuestionType.MULTIPLE_CHOICE,
    options: [
      { id: 'A', text: '$(4, 6)$', isCorrect: false },
      { id: 'B', text: '$(5, 7)$', isCorrect: true },
      { id: 'C', text: '$(6, 8)$', isCorrect: false },
      { id: 'D', text: '$(3, 5)$', isCorrect: false },
    ],
    correctAnswer: 'B',
    topicName: 'Coordinate Geometry',
    explanationShort:
      'Midpoint $=\\left(\\frac{x_1+x_2}{2},\\frac{y_1+y_2}{2}\\right)=\\left(\\frac{2+8}{2},\\frac{4+10}{2}\\right)=(5,7)$',
    explanationLong:
      'The midpoint formula:\n\n$$M=\\left(\\frac{x_1+x_2}{2},\\,\\frac{y_1+y_2}{2}\\right)$$\n\n' +
      '$$=\\left(\\frac{2+8}{2},\\,\\frac{4+10}{2}\\right)=\\left(\\frac{10}{2},\\,\\frac{14}{2}\\right)=\\boxed{(5,7)}$$',
    difficulty: QuestionDifficulty.EASY,
    marks: 1,
  },

  {
    examTypeName: 'WAEC',
    subjectName: 'Mathematics',
    category: QuestionCategory.OBJECTIVES,
    questionText:
      'Solve the simultaneous equations:\n\n$$x + y = 5 \\quad \\text{and} \\quad 2x - y = 1$$',
    type: QuestionType.MULTIPLE_CHOICE,
    options: [
      { id: 'A', text: '$x=3,\\;y=2$', isCorrect: false },
      { id: 'B', text: '$x=2,\\;y=3$', isCorrect: true },
      { id: 'C', text: '$x=4,\\;y=1$', isCorrect: false },
      { id: 'D', text: '$x=1,\\;y=4$', isCorrect: false },
    ],
    correctAnswer: 'B',
    topicName: 'Simultaneous Equations',
    explanationShort:
      'Add both equations: $3x=6\\Rightarrow x=2$, then $y=5-2=3$.',
    explanationLong:
      'Adding the two equations eliminates $y$:\n\n' +
      '$$(x+y)+(2x-y)=5+1\\Rightarrow 3x=6\\Rightarrow x=2$$\n\n' +
      'Substitute $x=2$ into the first equation:\n\n$$y=5-x=5-2=\\boxed{3}$$',
    difficulty: QuestionDifficulty.EASY,
    marks: 2,
  },

  {
    examTypeName: 'WAEC',
    subjectName: 'Mathematics',
    category: QuestionCategory.THEORY,
    questionText:
      '**[Theory]** A trader buys 200 articles at ₦3,500 each. ' +
      'He sells 120 of them at a profit of 20% and the remaining 80 at a loss of 10%.\n\n' +
      '(a) Calculate the total cost price.\n' +
      '(b) Calculate the total selling price.\n' +
      '(c) Find the overall profit or loss percentage, correct to 2 decimal places.',
    type: QuestionType.ESSAY,
    correctAnswer:
      '**(a) Total Cost Price:**\n$$\\text{TCP}=200\\times3{,}500=\\text{₦}700{,}000$$\n\n' +
      '**(b) Selling Price:**\n\nFor the 120 articles at 20% profit:\n' +
      '$$\\text{SP}_1=120\\times3{,}500\\times1.20=\\text{₦}504{,}000$$\n\n' +
      'For the 80 articles at 10% loss:\n' +
      '$$\\text{SP}_2=80\\times3{,}500\\times0.90=\\text{₦}252{,}000$$\n\n' +
      '$$\\text{Total SP}=504{,}000+252{,}000=\\text{₦}756{,}000$$\n\n' +
      '**(c) Overall Profit/Loss:**\n\n' +
      '$$\\text{Profit}=756{,}000-700{,}000=\\text{₦}56{,}000$$\n\n' +
      '$$\\text{Profit\\%}=\\frac{56{,}000}{700{,}000}\\times100=\\boxed{8.00\\%}$$',
    topicName: 'Commercial Arithmetic',
    explanationShort: 'TCP=₦700,000; TSP=₦756,000; Profit=₦56,000; Profit%=8%.',
    explanationLong:
      'Key steps:\n1. Total cost = unit cost × total quantity\n' +
      '2. Calculate each selling price group separately using the profit/loss multiplier\n' +
      '3. Profit% = (Profit / Cost) × 100\n\n' +
      'Always check: if total SP > total CP → profit; if SP < CP → loss.',
    difficulty: QuestionDifficulty.HARD,
    marks: 10,
  },

  {
    examTypeName: 'WAEC',
    subjectName: 'Mathematics',
    category: QuestionCategory.OBJECTIVES,
    questionText:
      'Find the compound interest on ₦50,000 invested at 10% per annum for 2 years.',
    type: QuestionType.MULTIPLE_CHOICE,
    options: [
      { id: 'A', text: '₦10,000', isCorrect: false },
      { id: 'B', text: '₦10,500', isCorrect: true },
      { id: 'C', text: '₦11,000', isCorrect: false },
      { id: 'D', text: '₦9,500', isCorrect: false },
    ],
    correctAnswer: 'B',
    topicName: 'Compound Interest',
    explanationShort:
      '$A=50{,}000\\times(1.1)^2=60{,}500$; CI$=60{,}500-50{,}000=\\text{₦}10{,}500$',
    explanationLong:
      'Compound Interest formula: $A=P\\left(1+\\frac{r}{100}\\right)^n$\n\n' +
      '$$A=50{,}000\\times(1.10)^2=50{,}000\\times1.21=60{,}500$$\n\n' +
      '$$\\text{CI}=A-P=60{,}500-50{,}000=\\boxed{\\text{₦}10{,}500}$$\n\n' +
      'Note: simple interest would give only ₦10,000 — CI is higher because interest compounds.',
    difficulty: QuestionDifficulty.MEDIUM,
    marks: 2,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // WAEC — Chemistry (Objectives + Theory + Practical)
  // ══════════════════════════════════════════════════════════════════════════

  {
    examTypeName: 'WAEC',
    subjectName: 'Chemistry',
    category: QuestionCategory.OBJECTIVES,
    questionText:
      'Which of the following is the correct electronic configuration of a sodium atom (atomic number 11)?',
    type: QuestionType.MULTIPLE_CHOICE,
    options: [
      { id: 'A', text: '2, 8, 1', isCorrect: true },
      { id: 'B', text: '2, 6, 3', isCorrect: false },
      { id: 'C', text: '2, 9', isCorrect: false },
      { id: 'D', text: '2, 8, 2', isCorrect: false },
    ],
    correctAnswer: 'A',
    topicName: 'Atomic Structure and Electronic Configuration',
    explanationShort:
      'Na (11 electrons): 2 in K shell, 8 in L shell, 1 in M shell → **2, 8, 1**.',
    explanationLong:
      'Electrons fill shells in order K → L → M → ...\n\n' +
      '| Shell | Max Capacity | Electrons in Na |\n|-------|-------------|------------------|\n' +
      '| K | 2 | 2 |\n| L | 8 | 8 |\n| M | 8 | 1 |\n\n' +
      'Configuration: **2, 8, 1**. The single outer electron makes Na highly reactive — ' +
      'it readily loses that electron to form Na⁺.',
    difficulty: QuestionDifficulty.EASY,
    marks: 1,
  },

  {
    examTypeName: 'WAEC',
    subjectName: 'Chemistry',
    category: QuestionCategory.THEORY,
    questionText:
      "**[Theory]** (a) State Hess's Law of constant heat summation.\n\n" +
      '(b) Using the standard enthalpies of formation below, calculate the standard enthalpy of combustion of methane ($\\text{CH}_4$):\n\n' +
      '$$\\Delta H_f^\\circ(\\text{CO}_2)=-393.5\\,\\text{kJ/mol}$$\n' +
      '$$\\Delta H_f^\\circ(\\text{H}_2\\text{O})=-285.8\\,\\text{kJ/mol}$$\n' +
      '$$\\Delta H_f^\\circ(\\text{CH}_4)=-74.8\\,\\text{kJ/mol}$$',
    type: QuestionType.ESSAY,
    correctAnswer:
      "**(a) Hess's Law:** The total enthalpy change for a reaction is the same regardless " +
      'of the route taken, provided initial and final conditions are the same.\n\n' +
      '**(b) Combustion of methane:**\n\n' +
      '$$\\text{CH}_4(g)+2\\text{O}_2(g)\\rightarrow\\text{CO}_2(g)+2\\text{H}_2\\text{O}(l)$$\n\n' +
      '$$\\Delta H_{\\text{comb}}^\\circ=[\\Delta H_f^\\circ(\\text{CO}_2)+2\\Delta H_f^\\circ(\\text{H}_2\\text{O})]-[\\Delta H_f^\\circ(\\text{CH}_4)+2\\times0]$$\n\n' +
      '$$=[-393.5+2(-285.8)]-[-74.8]=-965.1+74.8=\\boxed{-890.3\\,\\text{kJ/mol}}$$',
    topicName: "Hess's Law and Thermochemistry",
    explanationShort:
      '$\\Delta H_{\\text{rxn}}=\\sum\\Delta H_f^\\circ(\\text{products})-\\sum\\Delta H_f^\\circ(\\text{reactants})=-890.3\\,\\text{kJ/mol}$.',
    explanationLong:
      '**Step 1** — Write balanced equation: $\\text{CH}_4+2\\text{O}_2\\rightarrow\\text{CO}_2+2\\text{H}_2\\text{O}$\n\n' +
      "**Step 2** — Apply Hess's Law:\n" +
      '$$\\Delta H=[(-393.5)+2(-285.8)]-[(-74.8)+2(0)]=-965.1+74.8=-890.3\\,\\text{kJ/mol}$$\n\n' +
      'The negative sign confirms **exothermic** combustion.',
    difficulty: QuestionDifficulty.HARD,
    marks: 8,
  },

  {
    examTypeName: 'WAEC',
    subjectName: 'Chemistry',
    category: QuestionCategory.PRACTICAL,
    questionText:
      '**[Practical]** You are provided with:\n' +
      '- Solution **A**: $\\text{HCl}$ of unknown concentration\n' +
      '- Solution **B**: $0.1\\,\\text{mol/dm}^3$ $\\text{NaOH}$\n' +
      '- Phenolphthalein indicator\n\n' +
      'Describe the titration procedure, state the observations, and calculate the concentration of Solution A ' +
      'if the average titre was $25.0\\,\\text{cm}^3$.',
    type: QuestionType.ESSAY,
    correctAnswer:
      '**Procedure:**\n' +
      '1. Rinse burette with Solution A (HCl), fill and note initial reading.\n' +
      '2. Pipette $25.0\\,\\text{cm}^3$ of Solution B (NaOH) into a conical flask.\n' +
      '3. Add 2–3 drops of phenolphthalein → solution turns **pink**.\n' +
      '4. Run Solution A from burette into flask, swirling continuously.\n' +
      '5. **Endpoint**: pink just disappears (colourless). Note final burette reading.\n' +
      '6. Repeat until two titres agree within $0.10\\,\\text{cm}^3$. Use average titre.\n\n' +
      '**Calculation:**\n' +
      '$$n(\\text{NaOH})=0.1\\times\\frac{25.0}{1000}=0.0025\\,\\text{mol}$$\n\n' +
      'HCl : NaOH = 1 : 1, so $n(\\text{HCl})=0.0025\\,\\text{mol}$\n\n' +
      '$$c(\\text{HCl})=\\frac{0.0025}{25.0/1000}=\\boxed{0.1\\,\\text{mol/dm}^3}$$',
    topicName: 'Acid-Base Titration',
    explanationShort:
      'Titrate HCl (burette) against NaOH (pipette) using phenolphthalein. Endpoint = colourless. Use $c_1V_1=c_2V_2$.',
    explanationLong:
      'Examiner criteria:\n' +
      '- Correct indicator (phenolphthalein or methyl orange for strong acid/strong base)\n' +
      '- Correct endpoint description (phenolphthalein turns colourless in acid, NOT red)\n' +
      '- Three titrations, concordant results (within 0.10 cm³)\n' +
      '- Correct 1:1 mole ratio for HCl/NaOH\n' +
      '- Correct units throughout',
    difficulty: QuestionDifficulty.HARD,
    marks: 12,
  },

  {
    examTypeName: 'WAEC',
    subjectName: 'Chemistry',
    category: QuestionCategory.OBJECTIVES,
    questionText:
      'The average atomic mass of chlorine is approximately **35.5**. ' +
      'Given that chlorine has two isotopes: $^{35}_{17}\\text{Cl}$ (75%) and $^{37}_{17}\\text{Cl}$ (25%), ' +
      'verify this value.',
    type: QuestionType.MULTIPLE_CHOICE,
    options: [
      { id: 'A', text: '$35.0$', isCorrect: false },
      { id: 'B', text: '$35.5$', isCorrect: true },
      { id: 'C', text: '$36.0$', isCorrect: false },
      { id: 'D', text: '$37.0$', isCorrect: false },
    ],
    correctAnswer: 'B',
    topicName: 'Isotopes and Relative Atomic Mass',
    explanationShort: '$0.75\\times35+0.25\\times37=26.25+9.25=35.5$',
    explanationLong:
      'Average atomic mass = (fractional abundance × mass of each isotope), summed:\n\n' +
      '$$\\bar{m}=(0.75\\times35)+(0.25\\times37)=26.25+9.25=\\boxed{35.5}$$\n\n' +
      'This explains why the periodic table shows Cl = 35.5 (not a whole number).',
    difficulty: QuestionDifficulty.MEDIUM,
    marks: 2,
  },

  {
    examTypeName: 'WAEC',
    subjectName: 'Chemistry',
    category: QuestionCategory.OBJECTIVES,
    questionText:
      'In the Haber process for manufacturing ammonia:\n\n' +
      '$$\\text{N}_2(g) + 3\\text{H}_2(g) \\rightleftharpoons 2\\text{NH}_3(g) \\quad \\Delta H = -92\\,\\text{kJ/mol}$$\n\n' +
      'Which condition would **increase the yield** of ammonia?',
    type: QuestionType.MULTIPLE_CHOICE,
    options: [
      { id: 'A', text: 'Increasing temperature', isCorrect: false },
      { id: 'B', text: 'Decreasing pressure', isCorrect: false },
      { id: 'C', text: 'Increasing pressure', isCorrect: true },
      { id: 'D', text: 'Removing the catalyst', isCorrect: false },
    ],
    correctAnswer: 'C',
    topicName: "Chemical Equilibrium and Le Chatelier's Principle",
    explanationShort:
      'More moles of gas on left (4 mol) than right (2 mol) → high pressure favours NH₃ production.',
    explanationLong:
      "By **Le Chatelier's Principle**, the system shifts to oppose changes:\n\n" +
      '- **↑ Pressure** → shifts equilibrium toward fewer moles of gas (2 mol, right side) → ✅ more NH₃\n' +
      '- **↑ Temperature** → shifts left (exothermic reverse reaction) → ❌ less NH₃\n' +
      '- **↓ Pressure** → shifts toward more gas molecules (4 mol, left) → ❌ less NH₃\n' +
      '- Catalyst → speeds up rate to equilibrium but **does not change yield**\n\n' +
      'Industrial Haber process: ~200 atm pressure, 400–500°C (compromise for rate + yield), iron catalyst.',
    difficulty: QuestionDifficulty.HARD,
    marks: 2,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // WAEC — Biology (Objectives + Theory + Practical)
  // ══════════════════════════════════════════════════════════════════════════

  {
    examTypeName: 'WAEC',
    subjectName: 'Biology',
    category: QuestionCategory.OBJECTIVES,
    questionText:
      'Which hormone is responsible for the **"fight or flight"** response in humans?',
    type: QuestionType.MULTIPLE_CHOICE,
    options: [
      { id: 'A', text: 'Insulin', isCorrect: false },
      { id: 'B', text: 'Adrenaline (Epinephrine)', isCorrect: true },
      { id: 'C', text: 'Thyroxine', isCorrect: false },
      { id: 'D', text: 'Glucagon', isCorrect: false },
    ],
    correctAnswer: 'B',
    topicName: 'Hormones and the Endocrine System',
    explanationShort:
      'Adrenaline (epinephrine), from the adrenal medulla, triggers fight-or-flight.',
    explanationLong:
      '**Adrenaline** is released by the adrenal medulla in response to stress or danger:\n\n' +
      '- ↑ Heart rate and blood pressure\n- Dilates bronchioles (more O₂ to muscles)\n' +
      '- Pupil dilation\n- ↑ Blood glucose (from glycogen breakdown)\n' +
      '- Redirects blood flow to skeletal muscles\n\n' +
      'This prepares the body for rapid physical action.',
    difficulty: QuestionDifficulty.EASY,
    marks: 1,
  },

  {
    examTypeName: 'WAEC',
    subjectName: 'Biology',
    category: QuestionCategory.THEORY,
    questionText:
      '**[Theory]** With the aid of a **labelled diagram**, describe the structure of a nephron and explain how urine is produced. ' +
      'In your answer, include the roles of:\n\n' +
      '- Glomerular filtration\n- Selective reabsorption\n- Tubular secretion',
    type: QuestionType.ESSAY,
    correctAnswer:
      '**Nephron Structure** (Diagram labels required):\n\n' +
      "Bowman's capsule → Glomerulus → Proximal Convoluted Tubule (PCT) → " +
      'Loop of Henle (descending + ascending) → Distal Convoluted Tubule (DCT) → Collecting Duct\n\n' +
      '**1. Glomerular Filtration:**\n' +
      'Blood enters glomerulus under high pressure (narrow efferent arteriole). ' +
      "Small molecules (water, glucose, urea, salts) filter into Bowman's capsule as *glomerular filtrate*. " +
      'Large molecules (proteins, RBCs) remain in blood.\n\n' +
      '**2. Selective Reabsorption:**\n' +
      'In PCT and Loop of Henle: glucose, amino acids, and most water/salts are ' +
      'reabsorbed into peritubular capillaries. Loop of Henle concentrates filtrate via countercurrent mechanism.\n\n' +
      '**3. Tubular Secretion:**\n' +
      'In DCT: excess H⁺, K⁺, and some drugs are actively secreted from blood into tubule — helps regulate blood pH.\n\n' +
      '**Result:** Concentrated urine (water + urea + excess salts) flows to collecting duct → renal pelvis → ureter.',
    topicName: 'Excretion and the Kidney',
    explanationShort:
      'Filtration → reabsorption → secretion → concentrated urine. PCT reabsorbs glucose; loop concentrates.',
    explanationLong:
      'Examiner expects:\n' +
      '1. Labelled diagram with all segments named\n' +
      '2. Each process correctly attributed to correct segment\n' +
      '3. Countercurrent mechanism in loop of Henle\n' +
      '4. Blood pH regulation via H⁺ secretion\n' +
      '5. Distinction between what is reabsorbed vs what remains as urine',
    difficulty: QuestionDifficulty.HARD,
    marks: 15,
  },

  {
    examTypeName: 'WAEC',
    subjectName: 'Biology',
    category: QuestionCategory.PRACTICAL,
    questionText:
      '**[Practical]** Using the food samples provided (A–D), describe how you would test for the **presence of starch** and the **presence of reducing sugars**.\n\n' +
      'State the reagents used, the procedure, and the expected positive result for each test.',
    type: QuestionType.ESSAY,
    correctAnswer:
      '**Test for Starch (Sample A–D):**\n\n' +
      '**Reagent:** Iodine solution (potassium iodide solution)\n\n' +
      '**Procedure:**\n' +
      '1. Place a small amount of each sample in a white tile\n' +
      '2. Add 2–3 drops of iodine solution to each\n\n' +
      '**Positive result:** Blue-black colour → **starch present**\n' +
      'No colour change (remains orange-brown) → starch absent\n\n' +
      '---\n\n' +
      '**Test for Reducing Sugars:**\n\n' +
      "**Reagent:** Benedict's solution\n\n" +
      '**Procedure:**\n' +
      '1. Add 2 cm³ of each sample to separate test tubes\n' +
      "2. Add 1 cm³ of Benedict's solution to each\n" +
      '3. Place in boiling water bath for 5 minutes\n\n' +
      '**Positive result:** Brick-red/orange precipitate → **reducing sugars present**\n' +
      'Solution remains blue → no reducing sugars',
    topicName: 'Food Tests and Nutrition',
    explanationShort:
      "Starch: iodine → blue-black. Reducing sugars: Benedict's → brick-red (in hot water bath).",
    explanationLong:
      'Key points examiners look for:\n' +
      '- Correct reagent for each test\n' +
      "- Correct positive result description (not just 'colour change' — specify colour)\n" +
      "- Hot water bath specified for Benedict's test\n" +
      '- Controls mentioned (negative result description)\n' +
      '- Safety (handle boiling water carefully)',
    difficulty: QuestionDifficulty.MEDIUM,
    marks: 10,
  },

  {
    examTypeName: 'WAEC',
    subjectName: 'Biology',
    category: QuestionCategory.OBJECTIVES,
    questionText:
      'Where does **fertilisation** occur in a flowering plant?\n\n' +
      '![Labelled diagram of a flower showing stigma, style, ovary, and ovule]' +
      '(https://res.cloudinary.com/dsmjskppp/image/upload/main-sample.png)',
    type: QuestionType.MULTIPLE_CHOICE,
    options: [
      { id: 'A', text: 'On the stigma', isCorrect: false },
      { id: 'B', text: 'In the style', isCorrect: false },
      { id: 'C', text: 'Inside the ovule (embryo sac)', isCorrect: true },
      { id: 'D', text: 'On the anther', isCorrect: false },
    ],
    correctAnswer: 'C',
    topicName: 'Plant Reproduction and Fertilisation',
    explanationShort:
      'Fertilisation occurs inside the **ovule** (embryo sac) when the male gamete fuses with the egg cell.',
    explanationLong:
      'The sequence of events after pollination:\n\n' +
      '1. Pollen grain lands on **stigma**\n' +
      '2. Pollen tube grows down the **style**\n' +
      '3. Pollen tube enters **ovule** through the micropyle\n' +
      '4. Male gamete (from pollen) **fuses with egg cell** in the embryo sac → **fertilisation** ✓\n\n' +
      'After fertilisation: ovule → seed; ovary → fruit.',
    difficulty: QuestionDifficulty.MEDIUM,
    marks: 1,
  },

  {
    examTypeName: 'WAEC',
    subjectName: 'Biology',
    category: QuestionCategory.OBJECTIVES,
    questionText:
      'The **xylem** tissue in vascular plants is primarily responsible for:',
    type: QuestionType.MULTIPLE_CHOICE,
    options: [
      {
        id: 'A',
        text: 'Transporting sugar and amino acids from leaves to other parts',
        isCorrect: false,
      },
      {
        id: 'B',
        text: 'Transporting water and dissolved mineral salts from roots to leaves',
        isCorrect: true,
      },
      {
        id: 'C',
        text: 'Exchanging gases between the plant and environment',
        isCorrect: false,
      },
      { id: 'D', text: 'Storing starch in the stem', isCorrect: false },
    ],
    correctAnswer: 'B',
    topicName: 'Transport in Plants',
    explanationShort:
      'Xylem = water and minerals (roots → leaves). Phloem = sugars and amino acids (leaves → rest of plant).',
    explanationLong:
      '**Xylem** vs **Phloem** — often confused:\n\n' +
      '| Tissue | Transports | Direction |\n|--------|------------|----------|\n' +
      '| Xylem | Water + mineral salts | Roots → up |\n' +
      '| Phloem | Sugars, amino acids | Leaves → all directions |\n\n' +
      'Xylem cells are dead at maturity and have thick lignified walls. Water moves by transpiration pull.',
    difficulty: QuestionDifficulty.EASY,
    marks: 1,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // WAEC — Physics (Objectives + Theory + Practical)
  // ══════════════════════════════════════════════════════════════════════════

  {
    examTypeName: 'WAEC',
    subjectName: 'Physics',
    category: QuestionCategory.OBJECTIVES,
    questionText:
      'Calculate the pressure at a depth of $h = 5\\,\\text{m}$ in water.\n\n' +
      '*(Take density of water $\\rho = 1000\\,\\text{kg/m}^3$, $g = 10\\,\\text{m/s}^2$)*',
    type: QuestionType.MULTIPLE_CHOICE,
    options: [
      { id: 'A', text: '$25{,}000\\,\\text{Pa}$', isCorrect: false },
      { id: 'B', text: '$50{,}000\\,\\text{Pa}$', isCorrect: true },
      { id: 'C', text: '$100{,}000\\,\\text{Pa}$', isCorrect: false },
      { id: 'D', text: '$5{,}000\\,\\text{Pa}$', isCorrect: false },
    ],
    correctAnswer: 'B',
    topicName: 'Fluid Pressure and Density',
    explanationShort:
      '$P=\\rho g h=1000\\times10\\times5=50{,}000\\,\\text{Pa}$',
    explanationLong:
      'Pressure in a fluid depends only on depth, density, and gravity:\n\n' +
      '$$P=\\rho g h=1000\\,\\text{kg/m}^3\\times10\\,\\text{m/s}^2\\times5\\,\\text{m}=\\boxed{50{,}000\\,\\text{Pa}}$$\n\n' +
      'This is equivalent to $50\\,\\text{kPa}$, roughly half atmospheric pressure.',
    difficulty: QuestionDifficulty.EASY,
    marks: 1,
  },

  {
    examTypeName: 'WAEC',
    subjectName: 'Physics',
    category: QuestionCategory.OBJECTIVES,
    questionText: 'An alpha particle ($\\alpha$) is best described as:',
    type: QuestionType.MULTIPLE_CHOICE,
    options: [
      {
        id: 'A',
        text: 'A high-energy photon (electromagnetic radiation)',
        isCorrect: false,
      },
      {
        id: 'B',
        text: 'A helium nucleus: 2 protons + 2 neutrons, charge $+2e$',
        isCorrect: true,
      },
      {
        id: 'C',
        text: 'A high-speed electron emitted from the nucleus',
        isCorrect: false,
      },
      { id: 'D', text: 'A neutron emitted during fission', isCorrect: false },
    ],
    correctAnswer: 'B',
    topicName: 'Radioactivity and Nuclear Physics',
    explanationShort:
      'Alpha particle = helium nucleus ($^4_2\\text{He}$): 2 protons + 2 neutrons, charge = +2.',
    explanationLong:
      '**Comparison of ionising radiation:**\n\n' +
      '| Type | Composition | Charge | Penetrating Power |\n' +
      '|------|-------------|--------|-------------------|\n' +
      '| Alpha (α) | $^4_2\\text{He}$ nucleus | +2 | Very low (stopped by paper) |\n' +
      '| Beta (β) | Electron | −1 | Medium (stopped by Al) |\n' +
      '| Gamma (γ) | Photon (EM wave) | 0 | High (needs lead/concrete) |\n\n' +
      'Alpha particles are the **most ionising** but least penetrating.',
    difficulty: QuestionDifficulty.EASY,
    marks: 1,
  },

  {
    examTypeName: 'WAEC',
    subjectName: 'Physics',
    category: QuestionCategory.THEORY,
    questionText:
      "**[Theory]** (a) State **Faraday's Law of Electromagnetic Induction** and **Lenz's Law**.\n\n" +
      '(b) A coil of 200 turns experiences a change in magnetic flux of $0.05\\,\\text{Wb}$ in $0.1\\,\\text{s}$. ' +
      'Calculate the induced EMF.',
    type: QuestionType.ESSAY,
    correctAnswer:
      "**(a) Faraday's Law:** The magnitude of the induced EMF in a circuit is directly proportional to the rate of change of magnetic flux linkage.\n\n" +
      '$$|\\mathcal{E}|=N\\frac{\\Delta\\Phi}{\\Delta t}$$\n\n' +
      "**Lenz's Law:** The direction of the induced current is such that it opposes the change in flux that caused it (consistent with conservation of energy).\n\n" +
      '**(b) Calculation:**\n\n' +
      '$$|\\mathcal{E}|=N\\frac{\\Delta\\Phi}{\\Delta t}=200\\times\\frac{0.05}{0.1}=200\\times0.5=\\boxed{100\\,\\text{V}}$$',
    topicName: 'Electromagnetic Induction',
    explanationShort:
      '$\\mathcal{E}=N\\Delta\\Phi/\\Delta t=200\\times0.05/0.1=100\\,\\text{V}$',
    explanationLong:
      'Key points for full marks:\n' +
      "1. Faraday's Law: EMF ∝ rate of change of flux linkage (NΦ)\n" +
      "2. Lenz's Law: direction of opposition (like a brake on the flux change)\n" +
      '3. Correct substitution and calculation with units\n' +
      "4. Quote formula $\\mathcal{E}=-N\\Delta\\Phi/\\Delta t$ (negative sign from Lenz's Law)",
    difficulty: QuestionDifficulty.HARD,
    marks: 8,
  },

  {
    examTypeName: 'WAEC',
    subjectName: 'Physics',
    category: QuestionCategory.PRACTICAL,
    questionText:
      '**[Practical]** You are given a simple pendulum of length $L$ and asked to determine the acceleration due to gravity $g$.\n\n' +
      '(a) Describe the experiment, including measurements taken.\n' +
      '(b) State how you would calculate $g$ from your results.\n' +
      '(c) Given that the period $T = 2.0\\,\\text{s}$ and $L = 1.0\\,\\text{m}$, calculate $g$.',
    type: QuestionType.ESSAY,
    correctAnswer:
      '**(a) Experiment:**\n' +
      '1. Set up a pendulum with a bob attached to a string of known length $L$ (measure from pivot to centre of bob).\n' +
      '2. Displace the bob by a small angle (<10°) and release.\n' +
      '3. Measure the time for **20 complete oscillations** using a stopwatch.\n' +
      '4. Calculate period: $T=\\frac{\\text{total time}}{20}$.\n' +
      '5. Repeat for at least 3 different lengths $L$ and tabulate results.\n\n' +
      '**(b) Calculating $g$:**\n\n' +
      '$$T=2\\pi\\sqrt{\\frac{L}{g}}\\Rightarrow g=\\frac{4\\pi^2 L}{T^2}$$\n\n' +
      'Plot $T^2$ against $L$; gradient $=\\frac{4\\pi^2}{g}\\Rightarrow g=\\frac{4\\pi^2}{\\text{gradient}}$\n\n' +
      '**(c) Calculation:**\n\n' +
      '$$g=\\frac{4\\pi^2\\times1.0}{(2.0)^2}=\\frac{4\\times9.87}{4}\\approx\\boxed{9.87\\approx10\\,\\text{m/s}^2}$$',
    topicName: 'Simple Harmonic Motion and Pendulums',
    explanationShort:
      '$g=4\\pi^2L/T^2=4\\pi^2\\times1.0/4\\approx9.87\\,\\text{m/s}^2$',
    explanationLong:
      'Examiner marks scheme:\n' +
      '- Correct setup description (pivot, length measurement to centre of bob)\n' +
      '- Timing 20 oscillations (not 1 — reduces timing error)\n' +
      '- Correct formula $T=2\\pi\\sqrt{L/g}$ and rearrangement\n' +
      '- Graph method with $T^2$ vs $L$ for accuracy\n' +
      '- Correct numerical answer with units',
    difficulty: QuestionDifficulty.HARD,
    marks: 12,
  },

  {
    examTypeName: 'WAEC',
    subjectName: 'Physics',
    category: QuestionCategory.OBJECTIVES,
    questionText:
      'In the **photoelectric effect**, which change would **increase** the maximum kinetic energy of emitted photoelectrons?',
    type: QuestionType.MULTIPLE_CHOICE,
    options: [
      { id: 'A', text: 'Increasing the intensity of light', isCorrect: false },
      { id: 'B', text: 'Increasing the frequency of light', isCorrect: true },
      { id: 'C', text: 'Using a larger metal surface', isCorrect: false },
      {
        id: 'D',
        text: 'Decreasing the frequency but increasing intensity',
        isCorrect: false,
      },
    ],
    correctAnswer: 'B',
    topicName: 'Photoelectric Effect and Quantum Physics',
    explanationShort:
      'KE$_{\\max}=hf-\\phi$ → increasing frequency $f$ increases max KE of photoelectrons.',
    explanationLong:
      "Einstein's photoelectric equation:\n\n" +
      '$$\\text{KE}_{\\max}=hf-\\phi$$\n\n' +
      "where $h=$ Planck's constant, $f=$ frequency, $\\phi=$ work function.\n\n" +
      '- **Increasing frequency** → increases $hf$ → higher KE ✓\n' +
      '- **Increasing intensity** → more photons (more electrons emitted) but **same KE per electron** ❌\n' +
      '- **Larger surface** → no effect on KE ❌\n\n' +
      'If $f < f_0$ (threshold frequency), no electrons are emitted regardless of intensity.',
    difficulty: QuestionDifficulty.HARD,
    marks: 2,
  },
];
