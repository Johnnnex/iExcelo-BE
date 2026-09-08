import { Currency } from '../../../types';

// Base plan definitions (applied per exam type)
export const plansData = [
  {
    name: '1-Month Plan',
    description: 'Quick access for focused last-minute revision',
    durationDays: 30,
    sortOrder: 1,
    badge: 'Starter',
    perks: [
      'Access to full question bank',
      'Unlimited revision sessions',
      'Instant answer explanations',
      'Performance tracking dashboard',
    ],
  },
  {
    name: '2-Month Plan',
    description: 'Perfect for short-term exam preparation',
    durationDays: 60,
    sortOrder: 2,
    badge: null as string | null,
    perks: [
      'Access to full question bank',
      'Unlimited revision sessions',
      'Instant answer explanations',
      'Performance tracking dashboard',
      'Topic-by-topic progress tracking',
    ],
  },
  {
    name: '4-Month Plan',
    description: 'Most popular choice for comprehensive preparation',
    durationDays: 120,
    sortOrder: 3,
    badge: 'Most Popular',
    perks: [
      'Access to full question bank',
      'Unlimited revision and mock tests',
      'Instant answer explanations',
      'Performance tracking dashboard',
      'Topic-by-topic progress tracking',
      'Timed mock exam practice',
    ],
  },
  {
    name: '6-Month Plan',
    description: 'Best value for extended learning and revision',
    durationDays: 180,
    sortOrder: 4,
    badge: 'Best Value',
    perks: [
      'Access to full question bank',
      'Unlimited revision and mock tests',
      'Instant answer explanations',
      'Performance tracking dashboard',
      'Topic-by-topic progress tracking',
      'Timed mock exam practice',
      'Priority support access',
    ],
  },
];

export interface PlanPriceData {
  amount: number;
}

// Base prices per currency — used by migration 003 as defaults.
// Per-exam-type amounts are set by migration 007.
export const planPricesData: Record<Currency, PlanPriceData[]> = {
  // [1-month, 2-month, 4-month, 6-month]
  [Currency.NGN]: [
    { amount: 2000 },
    { amount: 3500 },
    { amount: 5000 },
    { amount: 6500 },
  ],
  [Currency.USD]: [{ amount: 3 }, { amount: 5 }, { amount: 7 }, { amount: 9 }],
  [Currency.GBP]: [{ amount: 3 }, { amount: 4 }, { amount: 6 }, { amount: 8 }],
  [Currency.EUR]: [{ amount: 3 }, { amount: 5 }, { amount: 7 }, { amount: 9 }],
  [Currency.CAD]: [
    { amount: 4 },
    { amount: 7 },
    { amount: 10 },
    { amount: 13 },
  ],
  [Currency.AUD]: [
    { amount: 5 },
    { amount: 8 },
    { amount: 11 },
    { amount: 14 },
  ],
  [Currency.GHS]: [
    { amount: 45 },
    { amount: 75 },
    { amount: 105 },
    { amount: 135 },
  ],
  [Currency.GMD]: [
    { amount: 200 },
    { amount: 350 },
    { amount: 490 },
    { amount: 630 },
  ],
  // New currencies — amounts are placeholders; set real values via Admin panel
  [Currency.ZAR]: [
    { amount: 60 },
    { amount: 100 },
    { amount: 140 },
    { amount: 180 },
  ],
  [Currency.KES]: [
    { amount: 400 },
    { amount: 700 },
    { amount: 1000 },
    { amount: 1300 },
  ],
  [Currency.UGX]: [
    { amount: 11000 },
    { amount: 19000 },
    { amount: 27000 },
    { amount: 35000 },
  ],
  [Currency.TZS]: [
    { amount: 7500 },
    { amount: 13000 },
    { amount: 18500 },
    { amount: 24000 },
  ],
  [Currency.XOF]: [
    { amount: 2000 },
    { amount: 3500 },
    { amount: 5000 },
    { amount: 6500 },
  ],
  [Currency.XAF]: [
    { amount: 2000 },
    { amount: 3500 },
    { amount: 5000 },
    { amount: 6500 },
  ],
  // New African currencies — set real amounts via Admin panel
  [Currency.LRD]: [],
  [Currency.SLE]: [],
  [Currency.CDF]: [],
  [Currency.MZN]: [],
  [Currency.NAD]: [],
};

/**
 * Paystack plan codes per exam type.
 * Each exam type MUST have its own set of plans in Paystack — otherwise
 * the subscription.create webhook can't reliably match the subscription_code
 * to the correct internal subscription.
 *
 * Structure: examTypeName → currency → [1-month code, 2-month code, 4-month code, 6-month code]
 *
 * Create these in Paystack Dashboard (Plans > Create Plan) with:
 *   - Name: "JAMB 1-Month Plan", "JAMB 2-Month Plan", etc.
 *   - Amount: matching the amount in planPricesData above (in kobo/subunit, so 2000 NGN = 200000)
 *   - Interval: "monthly" (Paystack bills monthly; our durationDays handles actual period)
 *
 * Fill in the PLN_xxx codes below after creating them.
 * KES and ZAR: create separate Paystack plans for those currencies too.
 */
export const paystackPlanCodes: Record<
  string,
  Partial<Record<Currency, string[]>>
> = {
  // [1-month, 2-month, 4-month, 6-month]
  // Index 0 (1-month) is new — create these plans in Paystack Dashboard and fill in codes
  JAMB: {
    [Currency.NGN]: [
      '', // 1-month — fill in after running paystack-seed-plans.ts
      '', // 2-month — Paystack has no 2-month interval; intentionally empty
      'PLN_pf590r2204z65fc', // 4-month
      'PLN_563tpi844nnugeh', // 6-month
    ],
  },
  WAEC: {
    [Currency.NGN]: [
      '',
      '', // 2-month — Paystack has no 2-month interval; intentionally empty
      'PLN_7dyq8pj4rfzq2ke',
      'PLN_x8hmg1hnz2rox8h',
    ],
  },
  NECO: {
    [Currency.NGN]: [
      '',
      '', // 2-month — Paystack has no 2-month interval; intentionally empty
      'PLN_lu5y6472yl7ipfy',
      'PLN_u2h536obyswnkkx',
    ],
  },
  'POST-JAMB': {
    [Currency.NGN]: [
      '',
      '', // 2-month — Paystack has no 2-month interval; intentionally empty
      'PLN_oc2a8sodbz3x14s',
      'PLN_ngpzgou16yiukvr',
    ],
  },
  GCE: {
    [Currency.NGN]: [
      '',
      '', // 2-month — Paystack has no 2-month interval; intentionally empty
      'PLN_igvcrw57pww8vu6',
      'PLN_z1koi95l5f1jwu1',
    ],
  },
  SAT: {
    [Currency.NGN]: [
      '',
      '', // 2-month — Paystack has no 2-month interval; intentionally empty
      'PLN_0m4xkpcei0yjasy',
      'PLN_2kt0zl47ow4rphk',
    ],
  },
};

// Plan features (same for all plans)
export const planFeatures = [
  'Unlimited revision and mock tests',
  'Real-time performance tracking',
  'Access to all subjects',
  'Detailed answer explanations',
];
