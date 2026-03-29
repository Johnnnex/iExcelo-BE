import { Currency } from '../../../types';

// Base plan definitions (applied per exam type)
// stripeProductId: Create products in Stripe Dashboard (Products > Add Product)
// Each plan is a separate product with multiple prices for different currencies
// TODO: Replace placeholder IDs with actual Stripe product IDs after creating them
export const plansData = [
  {
    name: '2-Month Plan',
    description: 'Perfect for short-term exam preparation',
    durationDays: 60,
    sortOrder: 1,
    badge: 'Starter',
    stripeProductId: 'prod_2month_placeholder', // TODO: Replace with actual Stripe product ID
  },
  {
    name: '4-Month Plan',
    description: 'Most popular choice for comprehensive preparation',
    durationDays: 120,
    sortOrder: 2,
    badge: 'Most Popular',
    stripeProductId: 'prod_4month_placeholder', // TODO: Replace with actual Stripe product ID
  },
  {
    name: '6-Month Plan',
    description: 'Best value for extended learning and revision',
    durationDays: 180,
    sortOrder: 3,
    badge: 'Best Value',
    stripeProductId: 'prod_6month_placeholder', // TODO: Replace with actual Stripe product ID
  },
];

// Prices per currency (applied to each plan)
// stripePriceId: Create recurring prices in Stripe Dashboard (Products > Add Price)
// paystackPlanCode: Create plans in Paystack Dashboard (Plans > Create Plan)
export interface PlanPriceData {
  amount: number;
  stripePriceId?: string; // Stripe price ID (e.g., 'price_xxx') - for Stripe regions
  paystackPlanCode?: string; // Paystack plan code (e.g., 'PLN_xxx') - for Nigeria/Africa
}

// Base prices per currency — amounts are the same across exam types,
// but Paystack plan codes MUST be unique per exam type (each exam type
// gets its own set of plans in Paystack). Stripe price IDs will also
// need to be unique per exam type when set up.
export const planPricesData: Record<Currency, PlanPriceData[]> = {
  // [2-month, 4-month, 6-month]
  [Currency.NGN]: [{ amount: 3500 }, { amount: 5000 }, { amount: 6500 }],
  [Currency.USD]: [{ amount: 5 }, { amount: 7 }, { amount: 9 }],
  [Currency.GBP]: [{ amount: 4 }, { amount: 6 }, { amount: 8 }],
  [Currency.EUR]: [{ amount: 5 }, { amount: 7 }, { amount: 9 }],
  [Currency.CAD]: [{ amount: 7 }, { amount: 10 }, { amount: 13 }],
  [Currency.AUD]: [{ amount: 8 }, { amount: 11 }, { amount: 14 }],
};

/**
 * Paystack plan codes per exam type.
 * Each exam type MUST have its own set of plans in Paystack — otherwise
 * the subscription.create webhook can't reliably match the subscription_code
 * to the correct internal subscription.
 *
 * Structure: examTypeName → currency → [2-month code, 4-month code, 6-month code]
 *
 * Create these in Paystack Dashboard (Plans > Create Plan) with:
 *   - Name: "JAMB 2-Month Plan", "WAEC 4-Month Plan", etc.
 *   - Amount: matching the amount in planPricesData above (in kobo, so 3500 NGN = 350000)
 *   - Interval: "monthly" (Paystack bills monthly; our durationDays handles actual period)
 *
 * Fill in the PLN_xxx codes below after creating them.
 */
export const paystackPlanCodes: Record<
  string,
  Partial<Record<Currency, string[]>>
> = {
  // [2-month, 4-month, 6-month]
  JAMB: {
    [Currency.NGN]: [
      'PLN_qywk2astce6ycjc', // 3500 NGN
      'PLN_pf590r2204z65fc', // 5000 NGN
      'PLN_563tpi844nnugeh', // 6500 NGN
    ],
  },
  WAEC: {
    [Currency.NGN]: [
      'PLN_fepvq6ihqumq1zl',
      'PLN_7dyq8pj4rfzq2ke',
      'PLN_x8hmg1hnz2rox8h',
    ],
  },
  NECO: {
    [Currency.NGN]: [
      'PLN_a1tbyioqg0xqjv0',
      'PLN_lu5y6472yl7ipfy',
      'PLN_u2h536obyswnkkx',
    ],
  },
  'POST-JAMB': {
    [Currency.NGN]: [
      'PLN_ilf8cfnyv7d7wgz',
      'PLN_oc2a8sodbz3x14s',
      'PLN_ngpzgou16yiukvr',
    ],
  },
  GCE: {
    [Currency.NGN]: [
      'PLN_iijt2c8hbubnzz2',
      'PLN_igvcrw57pww8vu6',
      'PLN_z1koi95l5f1jwu1',
    ],
  },
  SAT: {
    [Currency.NGN]: [
      'PLN_p74c6i6v2kn5j7o',
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
