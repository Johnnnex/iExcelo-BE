import { MigrationInterface, QueryRunner } from "typeorm";

export class DropStripeProductIdFromPlan1787576960298 implements MigrationInterface {
    name = 'DropStripeProductIdFromPlan1787576960298'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "subscription_plans" DROP COLUMN "stripeProductId"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "subscription_plans" ADD "stripeProductId" character varying`);
    }

}
