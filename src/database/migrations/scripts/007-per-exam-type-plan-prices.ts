import { DataSource } from 'typeorm';
import { IMigration } from '../migration-runner';
import { RegionCurrency } from '../../../subscriptions/entities/region-currency.entity';
import { SubscriptionPlan } from '../../../subscriptions/entities/subscription-plan.entity';
import { PlanPrice } from '../../../subscriptions/entities/plan-price.entity';
import { ExamType } from '../../../exams/entities/exam-type.entity';
import { Currency } from '../../../../types';

// Prices per currency: [1-Month, 2-Month, 4-Month, 6-Month]
const JAMB_PRICES: Partial<Record<Currency, [number, number, number, number]>> =
  {
    [Currency.NGN]: [4500, 7500, 10500, 15500],
    [Currency.GHS]: [65, 105, 175, 225],
    [Currency.GMD]: [475, 650, 950, 1350],
    [Currency.LRD]: [1050, 1600, 2400, 3800],
    [Currency.SLE]: [235, 315, 450, 600],
    [Currency.ZAR]: [200, 260, 350, 450],
    [Currency.XOF]: [3500, 4500, 6500, 10500],
    [Currency.XAF]: [3500, 4500, 6500, 10500],
    [Currency.CDF]: [6000, 8500, 11500, 16500],
    [Currency.UGX]: [11000, 16000, 21000, 36000],
    [Currency.TZS]: [8500, 11500, 16500, 26500],
    [Currency.KES]: [750, 1250, 1850, 3600],
    [Currency.MZN]: [400, 650, 950, 1250],
    [Currency.NAD]: [95, 160, 260, 400],
    [Currency.USD]: [14.99, 20.99, 29.99, 44.99],
    [Currency.GBP]: [14.99, 20.99, 29.99, 44.99],
    [Currency.CAD]: [19.99, 29.99, 39.99, 59.99],
    [Currency.AUD]: [14.99, 20.99, 29.99, 44.99],
    [Currency.EUR]: [14.99, 20.99, 29.99, 44.99],
  };

// WAEC, GCE, NECO share the same pricing
const WAEC_GCE_NECO_PRICES: Partial<
  Record<Currency, [number, number, number, number]>
> = {
  [Currency.NGN]: [3500, 6500, 9500, 14500],
  [Currency.GHS]: [55, 95, 165, 215],
  [Currency.GMD]: [375, 550, 850, 1250],
  [Currency.LRD]: [950, 1500, 2300, 3700],
  [Currency.SLE]: [135, 215, 350, 500],
  [Currency.ZAR]: [100, 160, 250, 350],
  [Currency.XOF]: [2500, 3500, 5500, 9500],
  [Currency.XAF]: [2500, 3500, 5500, 9500],
  [Currency.CDF]: [5000, 7500, 10500, 15500],
  [Currency.UGX]: [10000, 15000, 25000, 35000],
  [Currency.TZS]: [7500, 10500, 15500, 25500],
  [Currency.KES]: [650, 1150, 1750, 3500],
  [Currency.MZN]: [350, 550, 850, 1150],
  [Currency.NAD]: [85, 150, 250, 400],
  [Currency.USD]: [10, 15.99, 24.99, 39.99],
  [Currency.GBP]: [9.99, 15.99, 24.99, 39.99],
  [Currency.CAD]: [14.99, 24.99, 34.99, 54.99],
  [Currency.AUD]: [9.99, 15.99, 24.99, 39.99],
  [Currency.EUR]: [9.99, 15.99, 24.99, 39.99],
};

const PLAN_NAMES = [
  '1-Month Plan',
  '2-Month Plan',
  '4-Month Plan',
  '6-Month Plan',
] as const;

const EXAM_TYPE_PRICES: Record<
  string,
  Partial<Record<Currency, [number, number, number, number]>>
> = {
  JAMB: JAMB_PRICES,
  WAEC: WAEC_GCE_NECO_PRICES,
  GCE: WAEC_GCE_NECO_PRICES,
  NECO: WAEC_GCE_NECO_PRICES,
};

export const migration007: IMigration = {
  name: '007-per-exam-type-plan-prices',
  description:
    'Sets correct per-exam-type plan prices for JAMB, WAEC, GCE, NECO; fixes region currencies for LR and SL; adds CD, MZ, NA regions',

  async run(dataSource: DataSource): Promise<void> {
    const regionRepo = dataSource.getRepository(RegionCurrency);
    const examTypeRepo = dataSource.getRepository(ExamType);
    const planRepo = dataSource.getRepository(SubscriptionPlan);
    const priceRepo = dataSource.getRepository(PlanPrice);

    // ── 1. Fix and extend region currencies ───────────────────────────────────
    console.log('    Fixing region currencies...');

    // LR previously mapped to USD — now uses LRD
    await regionRepo.update({ regionCode: 'LR' }, { currency: Currency.LRD });
    console.log('      Updated LR: USD → LRD');

    // SL previously mapped to USD — now uses SLE
    await regionRepo.update({ regionCode: 'SL' }, { currency: Currency.SLE });
    console.log('      Updated SL: USD → SLE');

    const newRegions = [
      { regionCode: 'CD', regionName: 'DR Congo', currency: Currency.CDF },
      { regionCode: 'MZ', regionName: 'Mozambique', currency: Currency.MZN },
      { regionCode: 'NA', regionName: 'Namibia', currency: Currency.NAD },
    ];

    for (const r of newRegions) {
      const existing = await regionRepo.findOne({
        where: { regionCode: r.regionCode },
      });
      if (!existing) {
        await regionRepo.save(regionRepo.create({ ...r, isActive: true }));
        console.log(`      + Region: ${r.regionCode} (${r.currency})`);
      } else {
        console.log(`      ~ Region ${r.regionCode} already exists — skipping`);
      }
    }

    // ── 2. Set per-exam-type plan prices ─────────────────────────────────────
    console.log('    Setting per-exam-type plan prices...');

    let updated = 0;
    let created = 0;

    for (const [examTypeName, pricingTable] of Object.entries(
      EXAM_TYPE_PRICES,
    )) {
      const examType = await examTypeRepo.findOne({
        where: { name: examTypeName },
      });
      if (!examType) {
        console.warn(`    ⚠ ExamType "${examTypeName}" not found — skipping`);
        continue;
      }

      for (let planIdx = 0; planIdx < PLAN_NAMES.length; planIdx++) {
        const planName = PLAN_NAMES[planIdx];
        const plan = await planRepo.findOne({
          where: { examTypeId: examType.id, name: planName },
        });
        if (!plan) {
          console.warn(
            `    ⚠ Plan "${planName}" for ${examTypeName} not found — skipping`,
          );
          continue;
        }

        for (const [currency, amounts] of Object.entries(pricingTable) as [
          Currency,
          [number, number, number, number],
        ][]) {
          const amount = amounts[planIdx];
          const existing = await priceRepo.findOne({
            where: { planId: plan.id, currency },
          });

          if (existing) {
            await priceRepo.update({ id: existing.id }, { amount });
            updated++;
          } else {
            await priceRepo.save(
              priceRepo.create({
                planId: plan.id,
                currency,
                amount,
                isActive: true,
              }),
            );
            created++;
          }
        }
      }

      console.log(`      ${examTypeName}: prices set`);
    }

    console.log(`    Plan prices: ${updated} updated, ${created} created`);
  },
};
