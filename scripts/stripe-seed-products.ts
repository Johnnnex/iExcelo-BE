/**
 * stripe-seed-products.ts
 *
 * Creates Stripe products and recurring prices for all exam types and
 * currencies, then writes the externalId mapping to stripe-prices.json.
 *
 * Usage:
 *   npx ts-node -r dotenv/config scripts/stripe-seed-products.ts
 *
 *   Override key for a specific account (sandbox or live):
 *   STRIPE_SECRET_KEY=sk_live_xxx npx ts-node scripts/stripe-seed-products.ts
 *
 * Idempotent: searches for existing products/prices by metadata key before
 * creating, so it is safe to re-run.
 */

import Stripe from 'stripe';
import * as fs from 'fs';
import * as path from 'path';

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_KEY) {
  console.error('STRIPE_SECRET_KEY not set');
  process.exit(1);
}

const stripe = new Stripe(STRIPE_KEY);

// ── Pricing tables (mirrors migration 007) ────────────────────────────────────
// Index order: [1-Month, 2-Month, 4-Month, 6-Month]

type PriceRow = [number, number, number, number];

const JAMB_PRICES: Record<string, PriceRow> = {
  GMD: [475, 650, 950, 1350],
  LRD: [1050, 1600, 2400, 3800],
  SLE: [235, 315, 450, 600],
  ZAR: [200, 260, 350, 450],
  XOF: [3500, 4500, 6500, 10500],
  XAF: [3500, 4500, 6500, 10500],
  CDF: [6000, 8500, 11500, 16500],
  UGX: [11000, 16000, 21000, 36000],
  TZS: [8500, 11500, 16500, 26500],
  KES: [750, 1250, 1850, 3600],
  MZN: [400, 650, 950, 1250],
  NAD: [95, 160, 260, 400],
  USD: [14.99, 20.99, 29.99, 44.99],
  GBP: [14.99, 20.99, 29.99, 44.99],
  CAD: [19.99, 29.99, 39.99, 59.99],
  AUD: [14.99, 20.99, 29.99, 44.99],
  EUR: [14.99, 20.99, 29.99, 44.99],
};

const WAEC_GCE_NECO_PRICES: Record<string, PriceRow> = {
  GMD: [375, 550, 850, 1250],
  LRD: [950, 1500, 2300, 3700],
  SLE: [135, 215, 350, 500],
  ZAR: [100, 160, 250, 350],
  XOF: [2500, 3500, 5500, 9500],
  XAF: [2500, 3500, 5500, 9500],
  CDF: [5000, 7500, 10500, 15500],
  UGX: [10000, 15000, 25000, 35000],
  TZS: [7500, 10500, 15500, 25500],
  KES: [650, 1150, 1750, 3500],
  MZN: [350, 550, 850, 1150],
  NAD: [85, 150, 250, 400],
  USD: [10, 15.99, 24.99, 39.99],
  GBP: [9.99, 15.99, 24.99, 39.99],
  CAD: [14.99, 24.99, 34.99, 54.99],
  AUD: [9.99, 15.99, 24.99, 39.99],
  EUR: [9.99, 15.99, 24.99, 39.99],
};

const PLAN_NAMES = [
  '1-Month Plan',
  '2-Month Plan',
  '4-Month Plan',
  '6-Month Plan',
] as const;

// Calendar-month intervals for each plan
const PLAN_MONTHS = [1, 2, 4, 6] as const;

const EXAM_TYPES: Record<string, Record<string, PriceRow>> = {
  JAMB: JAMB_PRICES,
  WAEC: WAEC_GCE_NECO_PRICES,
  GCE: WAEC_GCE_NECO_PRICES,
  NECO: WAEC_GCE_NECO_PRICES,
};

// Stripe zero-decimal currencies — amount is NOT multiplied by 100
// UGX behaves as a 2-decimal currency in Stripe despite being theoretically
// zero-decimal, so it is intentionally excluded here.
const ZERO_DECIMAL = new Set(['XOF', 'XAF']);

function stripeAmount(currency: string, amount: number): number {
  return ZERO_DECIMAL.has(currency.toUpperCase())
    ? Math.round(amount)
    : Math.round(amount * 100);
}

// ── Stripe helpers ────────────────────────────────────────────────────────────

async function findOrCreateProduct(
  examType: string,
  planName: string,
  months: number,
): Promise<string> {
  const metaKey = `iexcelo_${examType}_${planName}`
    .replace(/\s+/g, '_')
    .toLowerCase();

  const existing = await stripe.products.search({
    query: `metadata['iexcelo_key']:'${metaKey}'`,
    limit: 1,
  });

  if (existing.data.length > 0) {
    return existing.data[0].id;
  }

  const product = await stripe.products.create({
    name: `iExcelo ${examType} ${planName}`,
    description: `${months}-month${months > 1 ? 's' : ''} of full access to iExcelo ${examType} exam preparation. Includes unlimited revision and mock tests, real-time performance tracking, and detailed answer explanations.`,
    tax_code: 'txcd_20060052', // Educational Services
    metadata: {
      iexcelo_key: metaKey,
      exam_type: examType,
      plan_name: planName,
      duration_months: String(months),
    },
  });

  return product.id;
}

async function findOrCreatePrice(
  productId: string,
  currency: string,
  amount: number,
  months: number,
  examType: string,
  planName: string,
): Promise<string> {
  const metaKey = `iexcelo_${examType}_${planName}_${currency}`
    .replace(/\s+/g, '_')
    .toLowerCase();

  const existing = await stripe.prices.search({
    query: `metadata['iexcelo_key']:'${metaKey}'`,
    limit: 1,
  });

  if (existing.data.length > 0) {
    return existing.data[0].id;
  }

  const price = await stripe.prices.create({
    product: productId,
    currency: currency.toLowerCase(),
    unit_amount: stripeAmount(currency, amount),
    recurring: {
      interval: 'month',
      interval_count: months,
    },
    metadata: {
      iexcelo_key: metaKey,
      exam_type: examType,
      plan_name: planName,
      currency: currency.toUpperCase(),
    },
  });

  return price.id;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const isLive = STRIPE_KEY!.startsWith('sk_live');
  console.log(`\nStripe account: ${isLive ? 'LIVE' : 'TEST'}`);
  console.log('='.repeat(60));

  // results[examType][planName][currency] = priceId
  const results: Record<string, Record<string, Record<string, string>>> = {};

  for (const [examType, pricingTable] of Object.entries(EXAM_TYPES)) {
    results[examType] = {};
    console.log(`\n${examType}`);

    for (let i = 0; i < PLAN_NAMES.length; i++) {
      const planName = PLAN_NAMES[i];
      const months = PLAN_MONTHS[i];
      results[examType][planName] = {};

      process.stdout.write(`  ${planName} (${months}mo): product... `);
      const productId = await findOrCreateProduct(examType, planName, months);
      process.stdout.write(`${productId}\n`);

      for (const [currency, amounts] of Object.entries(pricingTable)) {
        const amount = amounts[i];
        process.stdout.write(`    ${currency} ${amount}: price... `);
        const priceId = await findOrCreatePrice(
          productId,
          currency,
          amount,
          months,
          examType,
          planName,
        );
        process.stdout.write(`${priceId}\n`);
        results[examType][planName][currency] = priceId;
      }
    }
  }

  // ── Write JSON output file ────────────────────────────────────────────────
  // Write to Backend root (one level up from scripts/)
  const outFile = path.join(__dirname, '..', 'stripe-prices.json');
  fs.writeFileSync(outFile, JSON.stringify(results, null, 2));

  console.log('\n\n' + '='.repeat(60));
  console.log(`Written to: ${outFile}`);
  console.log(
    'Load into admin panel: Subscriptions -> plan -> Add Provider -> Stripe -> paste price_id as Provider ID',
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
