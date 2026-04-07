/**
 * Migration CLI — run with:
 *   npm run migrate              → run all pending
 *   npm run migrate 002          → run only migration 002
 *   npm run migrate 002 003 004  → run 002, 003, 004 in order
 *   npm run migrate --list       → show run/pending status
 */
import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { DataSource } from 'typeorm';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

// ── Entity imports (all entities the migration scripts touch) ─────────────────
import { MigrationHistory } from '../migration-history.entity';
import { Country } from '../../../utils/entities/country.entity';
import { ExamType } from '../../../exams/entities/exam-type.entity';
import { Subject } from '../../../exams/entities/subject.entity';
import { ExamTypeSubject } from '../../../exams/entities/exam-type-subject.entity';
import { Topic } from '../../../exams/entities/topic.entity';
import { ExamConfig } from '../../../exams/entities/exam-config.entity';
import { Question } from '../../../exams/entities/question.entity';
import { Passage } from '../../../exams/entities/passage.entity';
import { RegionCurrency } from '../../../subscriptions/entities/region-currency.entity';
import { SubscriptionPlan } from '../../../subscriptions/entities/subscription-plan.entity';
import { PlanPrice } from '../../../subscriptions/entities/plan-price.entity';

// ── Migration scripts ─────────────────────────────────────────────────────────
import { MigrationRunner } from '../migration-runner';
import { migration001 } from '../scripts/001-seed-countries';
import { migration002 } from '../scripts/002-seed-exam-types';
import { migration003 } from '../scripts/003-seed-subscription-plans';
import { migration004 } from '../scripts/004-import-questions';

const ALL_MIGRATIONS = [migration001, migration002, migration003, migration004];

async function createDataSource(): Promise<DataSource> {
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
    username: process.env.DATABASE_USER ?? 'postgres',
    password: process.env.DATABASE_PASSWORD ?? 'postgres',
    database: process.env.DATABASE_NAME ?? 'iexcelo',
    entities: [
      MigrationHistory,
      Country,
      ExamType,
      Subject,
      ExamTypeSubject,
      Topic,
      ExamConfig,
      Question,
      Passage,
      RegionCurrency,
      SubscriptionPlan,
      PlanPrice,
    ],
    synchronize: false,
    ssl:
      process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : false,
  });

  await ds.initialize();

  // Ensure migration_history table exists before the runner tries to use it
  await ds.query(`
    CREATE TABLE IF NOT EXISTS migration_history (
      id        UUID        PRIMARY KEY,
      name      VARCHAR     NOT NULL UNIQUE,
      "ranAt"   TIMESTAMPTZ NOT NULL,
      "durationMs" INTEGER,
      error     TEXT,
      "createdAt" TIMESTAMPTZ DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  return ds;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const isList = args.includes('--list');

  console.log('\niExcelo Migration CLI');
  console.log('━'.repeat(48));

  const ds = await createDataSource();
  const runner = new MigrationRunner(ds);

  try {
    if (isList) {
      await runner.list(ALL_MIGRATIONS);
      return;
    }

    // Optional filters: "npm run migrate 002 003" → run only matching prefix
    const filters = args.filter((a) => /^\d+/.test(a));
    const toRun =
      filters.length > 0
        ? ALL_MIGRATIONS.filter((m) =>
            filters.some((f) => m.name.startsWith(f)),
          )
        : ALL_MIGRATIONS;

    if (toRun.length === 0) {
      console.log('No matching migrations found for filters:', filters);
      return;
    }

    await runner.runAll(toRun);
    console.log('\n✔ All done.\n');
  } finally {
    await ds.destroy();
  }
}

main().catch((err: Error) => {
  console.error('\n✘ Migration failed:', err.message);
  process.exit(1);
});
