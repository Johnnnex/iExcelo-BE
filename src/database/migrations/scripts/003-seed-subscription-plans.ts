import { DataSource } from 'typeorm';
import { IMigration } from '../migration-runner';
import { RegionCurrency } from '../../../subscriptions/entities/region-currency.entity';
import { SubscriptionPlan } from '../../../subscriptions/entities/subscription-plan.entity';
import { PlanPrice } from '../../../subscriptions/entities/plan-price.entity';
import { ExamType } from '../../../exams/entities/exam-type.entity';
import {
  regionsData,
  defaultRegion,
  plansData,
  planPricesData,
  paystackPlanCodes,
} from '../../../subscriptions/data';
import { Currency } from '../../../../types';

export const migration003: IMigration = {
  name: '003-seed-subscription-plans',
  description:
    'Seeds RegionCurrencies, SubscriptionPlans, and PlanPrices for all active exam types',

  async run(dataSource: DataSource): Promise<void> {
    const regionRepo = dataSource.getRepository(RegionCurrency);
    const planRepo = dataSource.getRepository(SubscriptionPlan);
    const priceRepo = dataSource.getRepository(PlanPrice);
    const examTypeRepo = dataSource.getRepository(ExamType);

    // ── 1. RegionCurrencies ────────────────────────────────────────────────
    console.log('    Seeding region currencies...');
    const allRegions = [...regionsData, defaultRegion];
    for (const data of allRegions) {
      const existing = await regionRepo.findOne({
        where: { regionCode: data.regionCode },
      });
      if (!existing) {
        await regionRepo.save(regionRepo.create({ ...data, isActive: true }));
        console.log(`      + Region: ${data.regionCode} (${data.currency})`);
      }
    }

    // ── 2. SubscriptionPlans + PlanPrices ──────────────────────────────────
    console.log('    Seeding subscription plans...');
    const examTypes = await examTypeRepo.find({ where: { isActive: true } });

    if (examTypes.length === 0) {
      console.warn(
        '    ⚠  No active exam types found — run migration 002 first',
      );
      return;
    }

    let plansCreated = 0;
    let pricesCreated = 0;

    for (const examType of examTypes) {
      const examPlanCodes =
        (paystackPlanCodes as Record<string, Record<string, string[]>>)[
          examType.name
        ] || {};

      for (let planIdx = 0; planIdx < plansData.length; planIdx++) {
        const planData = plansData[planIdx];

        const existing = await planRepo.findOne({
          where: { examTypeId: examType.id, name: planData.name },
        });
        if (existing) continue;

        const plan = await planRepo.save(
          planRepo.create({
            examTypeId: examType.id,
            name: planData.name,
            description: planData.description,
            durationDays: planData.durationDays,
            sortOrder: planData.sortOrder,
            stripeProductId: planData.stripeProductId,
            isActive: true,
          }),
        );
        plansCreated++;

        // Create prices for each currency
        for (const [currency, prices] of Object.entries(planPricesData) as [
          Currency,
          (typeof planPricesData)[Currency],
        ][]) {
          const priceData = prices[planIdx];
          if (!priceData) continue;

          const paystackCodes = examPlanCodes[currency] || [];
          const paystackPlanCode = paystackCodes[planIdx];

          await priceRepo.save(
            priceRepo.create({
              planId: plan.id,
              currency,
              amount: priceData.amount,
              stripePriceId: priceData.stripePriceId,
              paystackPlanCode: paystackPlanCode,
              isActive: true,
            }),
          );
          pricesCreated++;
        }
      }
    }

    console.log(
      `    Plans: ${plansCreated} created, Prices: ${pricesCreated} created`,
    );
  },
};
