/**
 * paystack-seed-plans.ts
 *
 * Creates Paystack subscription plans for NGN and GHS, then writes
 * plan codes to paystack-plans.json in the Backend root.
 *
 * Usage:
 *   npx ts-node -r dotenv/config scripts/paystack-seed-plans.ts
 *
 * Paystack intervals used:
 *   1-Month  → monthly
 *   4-Month  → quarterly
 *   6-Month  → biannually
 *   Skipped: 2-Month (no matching Paystack interval)
 *
 * Idempotent: fetches existing plans by name before creating.
 */

import * as fs from 'fs';
import * as path from 'path';

const PAYSTACK_KEY = process.env.PAYSTACK_SECRET_KEY;
if (!PAYSTACK_KEY) {
  console.error('PAYSTACK_SECRET_KEY not set');
  process.exit(1);
}

// ── Pricing (NGN only for now) ────────────────────────────────────────────────
// Index order: [1-Month, 4-Month, 6-Month]  (2-Month skipped — no Paystack interval)

type SupportedRow = [number, number, number]; // [1mo, 4mo, 6mo]

const JAMB_PRICES: Record<string, SupportedRow> = {
  NGN: [4500, 10500, 15500],
};

const WAEC_GCE_NECO_PRICES: Record<string, SupportedRow> = {
  NGN: [3500, 9500, 14500],
};

const SUPPORTED_PLANS: Array<{
  name: string;
  interval: string;
  index: 0 | 1 | 2;
}> = [
  { name: '1-Month Plan', interval: 'monthly', index: 0 },
  { name: '4-Month Plan', interval: 'quarterly', index: 1 },
  { name: '6-Month Plan', interval: 'biannually', index: 2 },
];

const EXAM_TYPES: Record<string, Record<string, SupportedRow>> = {
  JAMB: JAMB_PRICES,
  WAEC: WAEC_GCE_NECO_PRICES,
  GCE: WAEC_GCE_NECO_PRICES,
  NECO: WAEC_GCE_NECO_PRICES,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

// Paystack amounts are in the smallest currency unit (kobo for NGN, pesewas for GHS)
function paystackAmount(amount: number): number {
  return Math.round(amount * 100);
}

interface PaystackPlan {
  plan_code: string;
  name: string;
  amount: number;
  interval: string;
  currency: string;
}

async function listPlans(
  page = 1,
  accumulated: PaystackPlan[] = [],
): Promise<PaystackPlan[]> {
  const res = await fetch(
    `https://api.paystack.co/plan?perPage=50&page=${page}`,
    {
      headers: { Authorization: `Bearer ${PAYSTACK_KEY}` },
    },
  );
  const body = (await res.json()) as {
    status: boolean;
    data: PaystackPlan[];
  };
  if (!body.status || body.data.length === 0) return accumulated;
  const all = [...accumulated, ...body.data];
  if (body.data.length === 50) return listPlans(page + 1, all);
  return all;
}

async function findOrCreatePlan(
  name: string,
  currency: string,
  amount: number,
  interval: string,
  allPlans: PaystackPlan[],
): Promise<string> {
  const existing = allPlans.find(
    (p) =>
      p.name === name &&
      p.currency.toUpperCase() === currency.toUpperCase() &&
      p.interval === interval,
  );
  if (existing) return existing.plan_code;

  const res = await fetch('https://api.paystack.co/plan', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PAYSTACK_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      amount: paystackAmount(amount),
      interval,
      currency: currency.toUpperCase(),
      description: `iExcelo ${name} — billed ${interval}`,
    }),
  });
  const body = (await res.json()) as {
    status: boolean;
    data?: { plan_code: string };
    message?: string;
  };
  if (!body.status || !body.data) {
    throw new Error(`Paystack plan creation failed: ${body.message}`);
  }
  return body.data.plan_code;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\nFetching existing Paystack plans...');
  const allPlans = await listPlans();
  console.log(`  Found ${allPlans.length} existing plan(s)`);

  // results[examType][planName][currency] = plan_code
  const results: Record<string, Record<string, Record<string, string>>> = {};

  for (const [examType, pricingTable] of Object.entries(EXAM_TYPES)) {
    results[examType] = {};
    console.log(`\n${examType}`);

    for (const { name: planName, interval, index } of SUPPORTED_PLANS) {
      results[examType][planName] = {};

      for (const [currency, amounts] of Object.entries(pricingTable)) {
        const amount = amounts[index];
        const fullName = `iExcelo ${examType} ${planName}`;
        process.stdout.write(`  ${planName} ${currency} ${amount}: plan... `);

        const planCode = await findOrCreatePlan(
          fullName,
          currency,
          amount,
          interval,
          allPlans,
        );
        process.stdout.write(`${planCode}\n`);
        results[examType][planName][currency] = planCode;
      }
    }

    console.log(
      `  (2-Month Plan skipped — Paystack has no matching interval)`,
    );
  }

  const outFile = path.join(__dirname, '..', 'paystack-plans.json');
  fs.writeFileSync(outFile, JSON.stringify(results, null, 2));

  console.log('\n\n' + '='.repeat(60));
  console.log(`Written to: ${outFile}`);
  console.log(
    'Run migration 009 to sync these plan codes into plan_price_providers.',
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
