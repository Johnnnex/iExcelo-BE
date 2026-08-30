import * as fs from 'fs';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { IMigration } from '../migration-runner';
import { ExamType } from '../../../exams/entities/exam-type.entity';
import { SubscriptionPlan } from '../../../subscriptions/entities/subscription-plan.entity';
import { PlanPrice } from '../../../subscriptions/entities/plan-price.entity';
import { PlanPriceProvider } from '../../../subscriptions/entities/plan-price-provider.entity';
import { PaymentProvider, Currency } from '../../../../types';

// paystack-plans.json shape: { [examType]: { [planName]: { [currency]: planCode } } }
type PaystackPlanMap = Record<string, Record<string, Record<string, string>>>;

export const migration009: IMigration = {
  name: '009-paystack-plan-ids',
  description:
    'Seeds Paystack plan codes from paystack-plans.json into plan_price_providers',

  async run(dataSource: DataSource): Promise<void> {
    const jsonPath = path.resolve('paystack-plans.json');
    if (!fs.existsSync(jsonPath)) {
      console.warn(
        `    ⚠ paystack-plans.json not found at ${jsonPath} — run scripts/paystack-seed-plans.ts first`,
      );
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const planMap: PaystackPlanMap = JSON.parse(
      fs.readFileSync(jsonPath, 'utf-8'),
    );

    const examTypeRepo = dataSource.getRepository(ExamType);
    const planRepo = dataSource.getRepository(SubscriptionPlan);
    const priceRepo = dataSource.getRepository(PlanPrice);
    const providerRepo = dataSource.getRepository(PlanPriceProvider);

    let upserted = 0;
    let skipped = 0;

    for (const [examTypeName, plans] of Object.entries(planMap)) {
      const examType = await examTypeRepo.findOne({
        where: { name: examTypeName },
      });
      if (!examType) {
        console.warn(`    ⚠ ExamType "${examTypeName}" not found — skipping`);
        continue;
      }

      for (const [planName, currencies] of Object.entries(plans)) {
        const plan = await planRepo.findOne({
          where: { examTypeId: examType.id, name: planName },
        });
        if (!plan) {
          console.warn(
            `    ⚠ Plan "${planName}" for ${examTypeName} not found — skipping`,
          );
          continue;
        }

        for (const [currency, planCode] of Object.entries(currencies)) {
          const planPrice = await priceRepo.findOne({
            where: { planId: plan.id, currency: currency as Currency },
          });
          if (!planPrice) {
            console.warn(
              `    ⚠ PlanPrice ${examTypeName}/${planName}/${currency} not found — skipping`,
            );
            skipped++;
            continue;
          }

          const existing = await providerRepo.findOne({
            where: {
              planPriceId: planPrice.id,
              provider: PaymentProvider.PAYSTACK,
            },
          });

          if (existing) {
            if (existing.externalId !== planCode) {
              existing.externalId = planCode;
              existing.isActive = true;
              await providerRepo.save(existing);
              upserted++;
            }
          } else {
            await providerRepo.save(
              providerRepo.create({
                planPriceId: planPrice.id,
                provider: PaymentProvider.PAYSTACK,
                externalId: planCode,
                isActive: true,
              }),
            );
            upserted++;
          }
        }
      }
    }

    console.log(
      `    Paystack providers: ${upserted} upserted, ${skipped} skipped (missing plan prices)`,
    );
  },
};
