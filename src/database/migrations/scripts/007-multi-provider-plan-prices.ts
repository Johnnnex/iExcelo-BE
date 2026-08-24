import type { IMigration } from '../migration-runner';
import type { DataSource } from 'typeorm';

export const migration007: IMigration = {
  name: '007-multi-provider-plan-prices',
  description:
    'Create plan_price_providers table, migrate provider IDs from plan_prices, drop provider columns from region_currencies, add new currency enum values',

  async run(dataSource: DataSource): Promise<void> {
    await dataSource.transaction(async (em) => {
      // ── 1. Add new Currency enum values idempotently ─────────────────────────
      const newCurrencies = ['ZAR', 'KES', 'UGX', 'TZS', 'XOF', 'XAF'];
      for (const val of newCurrencies) {
        // Collect all enum type names that include currency values
        const enumTypes: { typname: string }[] = await em.query(`
          SELECT t.typname
          FROM pg_type t
          JOIN pg_em e ON e.enumtypid = t.oid
          WHERE e.enumlabel = 'USD'
        `);

        for (const { typname } of enumTypes) {
          await em.query(`
            DO $$ BEGIN
              IF NOT EXISTS (
                SELECT 1 FROM pg_enum
                JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
                WHERE pg_type.typname = '${typname}' AND pg_enum.enumlabel = '${val}'
              ) THEN
                ALTER TYPE ${typname} ADD VALUE '${val}';
              END IF;
            END $$;
          `);
        }
      }

      // ── 2. Add 1-month plan data for existing plans ──────────────────────────
      // Seeded by 003-seed-subscription-plans. If the 1-month plan doesn't exist
      // for an exam type, it will be created when the seed script next runs.
      // Nothing to do here — the entity/data layer handles it.

      // ── 3. Create plan_price_providers table ─────────────────────────────────
      await em.query(`
        CREATE TABLE IF NOT EXISTS plan_price_providers (
          id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
          "planPriceId"    UUID        NOT NULL REFERENCES plan_prices(id) ON DELETE CASCADE,
          provider         TEXT        NOT NULL,
          "stripePriceId"  TEXT,
          "paystackPlanCode" TEXT,
          "isActive"       BOOLEAN     NOT NULL DEFAULT true,
          "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE ("planPriceId", provider)
        )
      `);

      await em.query(`
        CREATE INDEX IF NOT EXISTS idx_plan_price_providers_plan_price_id
        ON plan_price_providers ("planPriceId")
      `);

      // ── 4. Migrate existing stripePriceId / paystackPlanCode ─────────────────
      // For each plan_price row that has a stripePriceId, create a STRIPE provider entry.
      // For each row that has a paystackPlanCode, create a PAYSTACK provider entry.
      await em.query(`
        INSERT INTO plan_price_providers ("planPriceId", provider, "stripePriceId", "isActive")
        SELECT id, 'stripe', "stripePriceId", true
        FROM plan_prices
        WHERE "stripePriceId" IS NOT NULL AND "stripePriceId" != ''
        ON CONFLICT ("planPriceId", provider) DO NOTHING
      `);

      await em.query(`
        INSERT INTO plan_price_providers ("planPriceId", provider, "paystackPlanCode", "isActive")
        SELECT id, 'paystack', "paystackPlanCode", true
        FROM plan_prices
        WHERE "paystackPlanCode" IS NOT NULL AND "paystackPlanCode" != ''
        ON CONFLICT ("planPriceId", provider) DO NOTHING
      `);

      // ── 5. Drop provider columns from region_currencies if they exist ─────────
      await em.query(`
        ALTER TABLE region_currencies
        DROP COLUMN IF EXISTS "paymentProvider",
        DROP COLUMN IF EXISTS "secondaryProvider"
      `);

      console.log('    ✓ plan_price_providers table created and populated');
      console.log('    ✓ Provider columns removed from region_currencies');
    });
  },
};
