import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCategoryIndex1791728630345 implements MigrationInterface {
    name = 'AddCategoryIndex1791728630345'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX "IDX_d262d3f68e4a21ea50c7f0b5c9" ON "questions" ("category") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_d262d3f68e4a21ea50c7f0b5c9"`);
    }

}
