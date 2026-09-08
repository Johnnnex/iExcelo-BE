import { DataSource } from 'typeorm';
import { IMigration } from '../migration-runner';
import { SubscriptionPlan } from '../../../subscriptions/entities/subscription-plan.entity';

// Matches plansData — sets badge, perks, and corrects sort orders for existing plans
const PLAN_SEEDS: Array<{
  name: string;
  sortOrder: number;
  badge: string | null;
  perks: string[];
}> = [
  {
    name: '1-Month Plan',
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
    sortOrder: 2,
    badge: null,
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

export const migration010: IMigration = {
  name: '010-plan-badge-perks',
  description:
    'Adds badge and perks columns to subscription_plans; corrects sort orders; seeds defaults for existing plans',

  async run(dataSource: DataSource): Promise<void> {
    // Add columns if they do not exist (idempotent via IF NOT EXISTS)
    await dataSource.query(`
      ALTER TABLE subscription_plans
        ADD COLUMN IF NOT EXISTS badge text,
        ADD COLUMN IF NOT EXISTS perks jsonb NOT NULL DEFAULT '[]'
    `);

    const planRepo = dataSource.getRepository(SubscriptionPlan);
    let updated = 0;

    for (const seed of PLAN_SEEDS) {
      const result = await planRepo
        .createQueryBuilder()
        .update()
        .set({
          sortOrder: seed.sortOrder,
          badge: seed.badge as string,
          perks: seed.perks,
        })
        .where('name = :name', { name: seed.name })
        .execute();

      updated += result.affected ?? 0;
      console.log(
        `      ${seed.name}: sortOrder=${seed.sortOrder}, badge=${seed.badge ?? 'none'}, perks=${seed.perks.length}`,
      );
    }

    console.log(`    Updated ${updated} plan row(s) across all exam types`);
  },
};
