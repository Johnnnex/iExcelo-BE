import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchemaSync1788128823984 implements MigrationInterface {
  name = 'InitialSchemaSync1788128823984';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "plan_price_providers" DROP COLUMN "stripePriceId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "plan_price_providers" DROP COLUMN "paystackPlanCode"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscription_plans" DROP COLUMN "stripeProductId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "plan_price_providers" ADD "externalId" character varying`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."donations_currency_enum" RENAME TO "donations_currency_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."donations_currency_enum" AS ENUM('NGN', 'USD', 'GBP', 'EUR', 'CAD', 'AUD', 'GHS', 'GMD', 'ZAR', 'KES', 'UGX', 'TZS', 'XOF', 'XAF', 'LRD', 'SLE', 'CDF', 'MZN', 'NAD')`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" ALTER COLUMN "currency" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" ALTER COLUMN "currency" TYPE "public"."donations_currency_enum" USING "currency"::"text"::"public"."donations_currency_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" ALTER COLUMN "currency" SET DEFAULT 'NGN'`,
    );
    await queryRunner.query(`DROP TYPE "public"."donations_currency_enum_old"`);
    await queryRunner.query(
      `ALTER TYPE "public"."givebacks_currency_enum" RENAME TO "givebacks_currency_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."givebacks_currency_enum" AS ENUM('NGN', 'USD', 'GBP', 'EUR', 'CAD', 'AUD', 'GHS', 'GMD', 'ZAR', 'KES', 'UGX', 'TZS', 'XOF', 'XAF', 'LRD', 'SLE', 'CDF', 'MZN', 'NAD')`,
    );
    await queryRunner.query(
      `ALTER TABLE "givebacks" ALTER COLUMN "currency" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "givebacks" ALTER COLUMN "currency" TYPE "public"."givebacks_currency_enum" USING "currency"::"text"::"public"."givebacks_currency_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "givebacks" ALTER COLUMN "currency" SET DEFAULT 'NGN'`,
    );
    await queryRunner.query(`DROP TYPE "public"."givebacks_currency_enum_old"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_216079c4298f848a15e49bd94b"`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."plan_prices_currency_enum" RENAME TO "plan_prices_currency_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."plan_prices_currency_enum" AS ENUM('NGN', 'USD', 'GBP', 'EUR', 'CAD', 'AUD', 'GHS', 'GMD', 'ZAR', 'KES', 'UGX', 'TZS', 'XOF', 'XAF', 'LRD', 'SLE', 'CDF', 'MZN', 'NAD')`,
    );
    await queryRunner.query(
      `ALTER TABLE "plan_prices" ALTER COLUMN "currency" TYPE "public"."plan_prices_currency_enum" USING "currency"::"text"::"public"."plan_prices_currency_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."plan_prices_currency_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."transactions_currency_enum" RENAME TO "transactions_currency_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."transactions_currency_enum" AS ENUM('NGN', 'USD', 'GBP', 'EUR', 'CAD', 'AUD', 'GHS', 'GMD', 'ZAR', 'KES', 'UGX', 'TZS', 'XOF', 'XAF', 'LRD', 'SLE', 'CDF', 'MZN', 'NAD')`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" ALTER COLUMN "currency" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" ALTER COLUMN "currency" TYPE "public"."transactions_currency_enum" USING "currency"::"text"::"public"."transactions_currency_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" ALTER COLUMN "currency" SET DEFAULT 'NGN'`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."transactions_currency_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."subscriptions_currency_enum" RENAME TO "subscriptions_currency_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."subscriptions_currency_enum" AS ENUM('NGN', 'USD', 'GBP', 'EUR', 'CAD', 'AUD', 'GHS', 'GMD', 'ZAR', 'KES', 'UGX', 'TZS', 'XOF', 'XAF', 'LRD', 'SLE', 'CDF', 'MZN', 'NAD')`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" ALTER COLUMN "currency" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" ALTER COLUMN "currency" TYPE "public"."subscriptions_currency_enum" USING "currency"::"text"::"public"."subscriptions_currency_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" ALTER COLUMN "currency" SET DEFAULT 'NGN'`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."subscriptions_currency_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."region_currencies_currency_enum" RENAME TO "region_currencies_currency_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."region_currencies_currency_enum" AS ENUM('NGN', 'USD', 'GBP', 'EUR', 'CAD', 'AUD', 'GHS', 'GMD', 'ZAR', 'KES', 'UGX', 'TZS', 'XOF', 'XAF', 'LRD', 'SLE', 'CDF', 'MZN', 'NAD')`,
    );
    await queryRunner.query(
      `ALTER TABLE "region_currencies" ALTER COLUMN "currency" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "region_currencies" ALTER COLUMN "currency" TYPE "public"."region_currencies_currency_enum" USING "currency"::"text"::"public"."region_currencies_currency_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "region_currencies" ALTER COLUMN "currency" SET DEFAULT 'USD'`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."region_currencies_currency_enum_old"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f3fd460802a6b5a4d93d2a2ca9"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_01f2b8f755e79b7536a08d61e4"`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."commissions_currency_enum" RENAME TO "commissions_currency_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."commissions_currency_enum" AS ENUM('NGN', 'USD', 'GBP', 'EUR', 'CAD', 'AUD', 'GHS', 'GMD', 'ZAR', 'KES', 'UGX', 'TZS', 'XOF', 'XAF', 'LRD', 'SLE', 'CDF', 'MZN', 'NAD')`,
    );
    await queryRunner.query(
      `ALTER TABLE "commissions" ALTER COLUMN "currency" TYPE "public"."commissions_currency_enum" USING "currency"::"text"::"public"."commissions_currency_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."commissions_currency_enum_old"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_7bbd56b5622ff6cbe64c17ff2c"`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."affiliate_payouts_currency_enum" RENAME TO "affiliate_payouts_currency_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."affiliate_payouts_currency_enum" AS ENUM('NGN', 'USD', 'GBP', 'EUR', 'CAD', 'AUD', 'GHS', 'GMD', 'ZAR', 'KES', 'UGX', 'TZS', 'XOF', 'XAF', 'LRD', 'SLE', 'CDF', 'MZN', 'NAD')`,
    );
    await queryRunner.query(
      `ALTER TABLE "affiliate_payouts" ALTER COLUMN "currency" TYPE "public"."affiliate_payouts_currency_enum" USING "currency"::"text"::"public"."affiliate_payouts_currency_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."affiliate_payouts_currency_enum_old"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a89bcd3d2ff05a89d958d1733d"`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."affiliate_payout_accounts_currency_enum" RENAME TO "affiliate_payout_accounts_currency_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."affiliate_payout_accounts_currency_enum" AS ENUM('NGN', 'USD', 'GBP', 'EUR', 'CAD', 'AUD', 'GHS', 'GMD', 'ZAR', 'KES', 'UGX', 'TZS', 'XOF', 'XAF', 'LRD', 'SLE', 'CDF', 'MZN', 'NAD')`,
    );
    await queryRunner.query(
      `ALTER TABLE "affiliate_payout_accounts" ALTER COLUMN "currency" TYPE "public"."affiliate_payout_accounts_currency_enum" USING "currency"::"text"::"public"."affiliate_payout_accounts_currency_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."affiliate_payout_accounts_currency_enum_old"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_216079c4298f848a15e49bd94b" ON "plan_prices" ("planId", "currency") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f3fd460802a6b5a4d93d2a2ca9" ON "commissions" ("affiliateId", "currency", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_01f2b8f755e79b7536a08d61e4" ON "commissions" ("affiliateId", "currency", "amount") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7bbd56b5622ff6cbe64c17ff2c" ON "affiliate_payouts" ("affiliateId", "currency") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a89bcd3d2ff05a89d958d1733d" ON "affiliate_payout_accounts" ("affiliateId", "currency") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a89bcd3d2ff05a89d958d1733d"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_7bbd56b5622ff6cbe64c17ff2c"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_01f2b8f755e79b7536a08d61e4"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f3fd460802a6b5a4d93d2a2ca9"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_216079c4298f848a15e49bd94b"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."affiliate_payout_accounts_currency_enum_old" AS ENUM('NGN', 'USD', 'GBP', 'EUR', 'CAD', 'AUD', 'GHS', 'GMD', 'ZAR', 'KES', 'UGX', 'TZS', 'XOF', 'XAF')`,
    );
    await queryRunner.query(
      `ALTER TABLE "affiliate_payout_accounts" ALTER COLUMN "currency" TYPE "public"."affiliate_payout_accounts_currency_enum_old" USING "currency"::"text"::"public"."affiliate_payout_accounts_currency_enum_old"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."affiliate_payout_accounts_currency_enum"`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."affiliate_payout_accounts_currency_enum_old" RENAME TO "affiliate_payout_accounts_currency_enum"`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a89bcd3d2ff05a89d958d1733d" ON "affiliate_payout_accounts" ("affiliateId", "currency") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."affiliate_payouts_currency_enum_old" AS ENUM('NGN', 'USD', 'GBP', 'EUR', 'CAD', 'AUD', 'GHS', 'GMD', 'ZAR', 'KES', 'UGX', 'TZS', 'XOF', 'XAF')`,
    );
    await queryRunner.query(
      `ALTER TABLE "affiliate_payouts" ALTER COLUMN "currency" TYPE "public"."affiliate_payouts_currency_enum_old" USING "currency"::"text"::"public"."affiliate_payouts_currency_enum_old"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."affiliate_payouts_currency_enum"`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."affiliate_payouts_currency_enum_old" RENAME TO "affiliate_payouts_currency_enum"`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7bbd56b5622ff6cbe64c17ff2c" ON "affiliate_payouts" ("affiliateId", "currency") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."commissions_currency_enum_old" AS ENUM('NGN', 'USD', 'GBP', 'EUR', 'CAD', 'AUD', 'GHS', 'GMD', 'ZAR', 'KES', 'UGX', 'TZS', 'XOF', 'XAF')`,
    );
    await queryRunner.query(
      `ALTER TABLE "commissions" ALTER COLUMN "currency" TYPE "public"."commissions_currency_enum_old" USING "currency"::"text"::"public"."commissions_currency_enum_old"`,
    );
    await queryRunner.query(`DROP TYPE "public"."commissions_currency_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."commissions_currency_enum_old" RENAME TO "commissions_currency_enum"`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_01f2b8f755e79b7536a08d61e4" ON "commissions" ("affiliateId", "amount", "currency") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f3fd460802a6b5a4d93d2a2ca9" ON "commissions" ("affiliateId", "createdAt", "currency") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."region_currencies_currency_enum_old" AS ENUM('NGN', 'USD', 'GBP', 'EUR', 'CAD', 'AUD', 'GHS', 'GMD', 'ZAR', 'KES', 'UGX', 'TZS', 'XOF', 'XAF')`,
    );
    await queryRunner.query(
      `ALTER TABLE "region_currencies" ALTER COLUMN "currency" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "region_currencies" ALTER COLUMN "currency" TYPE "public"."region_currencies_currency_enum_old" USING "currency"::"text"::"public"."region_currencies_currency_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "region_currencies" ALTER COLUMN "currency" SET DEFAULT 'USD'`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."region_currencies_currency_enum"`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."region_currencies_currency_enum_old" RENAME TO "region_currencies_currency_enum"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."subscriptions_currency_enum_old" AS ENUM('NGN', 'USD', 'GBP', 'EUR', 'CAD', 'AUD', 'GHS', 'GMD', 'ZAR', 'KES', 'UGX', 'TZS', 'XOF', 'XAF')`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" ALTER COLUMN "currency" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" ALTER COLUMN "currency" TYPE "public"."subscriptions_currency_enum_old" USING "currency"::"text"::"public"."subscriptions_currency_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" ALTER COLUMN "currency" SET DEFAULT 'NGN'`,
    );
    await queryRunner.query(`DROP TYPE "public"."subscriptions_currency_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."subscriptions_currency_enum_old" RENAME TO "subscriptions_currency_enum"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."transactions_currency_enum_old" AS ENUM('NGN', 'USD', 'GBP', 'EUR', 'CAD', 'AUD', 'GHS', 'GMD', 'ZAR', 'KES', 'UGX', 'TZS', 'XOF', 'XAF')`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" ALTER COLUMN "currency" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" ALTER COLUMN "currency" TYPE "public"."transactions_currency_enum_old" USING "currency"::"text"::"public"."transactions_currency_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" ALTER COLUMN "currency" SET DEFAULT 'NGN'`,
    );
    await queryRunner.query(`DROP TYPE "public"."transactions_currency_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."transactions_currency_enum_old" RENAME TO "transactions_currency_enum"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."plan_prices_currency_enum_old" AS ENUM('NGN', 'USD', 'GBP', 'EUR', 'CAD', 'AUD', 'GHS', 'GMD', 'ZAR', 'KES', 'UGX', 'TZS', 'XOF', 'XAF')`,
    );
    await queryRunner.query(
      `ALTER TABLE "plan_prices" ALTER COLUMN "currency" TYPE "public"."plan_prices_currency_enum_old" USING "currency"::"text"::"public"."plan_prices_currency_enum_old"`,
    );
    await queryRunner.query(`DROP TYPE "public"."plan_prices_currency_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."plan_prices_currency_enum_old" RENAME TO "plan_prices_currency_enum"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_216079c4298f848a15e49bd94b" ON "plan_prices" ("currency", "planId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."givebacks_currency_enum_old" AS ENUM('NGN', 'USD', 'GBP', 'EUR', 'CAD', 'AUD', 'GHS', 'GMD', 'ZAR', 'KES', 'UGX', 'TZS', 'XOF', 'XAF')`,
    );
    await queryRunner.query(
      `ALTER TABLE "givebacks" ALTER COLUMN "currency" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "givebacks" ALTER COLUMN "currency" TYPE "public"."givebacks_currency_enum_old" USING "currency"::"text"::"public"."givebacks_currency_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "givebacks" ALTER COLUMN "currency" SET DEFAULT 'NGN'`,
    );
    await queryRunner.query(`DROP TYPE "public"."givebacks_currency_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."givebacks_currency_enum_old" RENAME TO "givebacks_currency_enum"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."donations_currency_enum_old" AS ENUM('NGN', 'USD', 'GBP', 'EUR', 'CAD', 'AUD', 'GHS', 'GMD', 'ZAR', 'KES', 'UGX', 'TZS', 'XOF', 'XAF')`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" ALTER COLUMN "currency" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" ALTER COLUMN "currency" TYPE "public"."donations_currency_enum_old" USING "currency"::"text"::"public"."donations_currency_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" ALTER COLUMN "currency" SET DEFAULT 'NGN'`,
    );
    await queryRunner.query(`DROP TYPE "public"."donations_currency_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."donations_currency_enum_old" RENAME TO "donations_currency_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "plan_price_providers" DROP COLUMN "externalId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscription_plans" ADD "stripeProductId" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "plan_price_providers" ADD "paystackPlanCode" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "plan_price_providers" ADD "stripePriceId" character varying`,
    );
  }
}
