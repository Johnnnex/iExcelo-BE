import { MigrationInterface, QueryRunner } from "typeorm";

export class MakeLastNameNullable1777734622224 implements MigrationInterface {
    name = 'MakeLastNameNullable1777734622224'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "lastName" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "lastName" SET NOT NULL`);
    }

}
