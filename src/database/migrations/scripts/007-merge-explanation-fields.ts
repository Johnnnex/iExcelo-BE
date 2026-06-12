import { DataSource } from 'typeorm';
import { IMigration } from '../migration-runner';

export const migration007: IMigration = {
  name: '007-merge-explanation-fields',
  description: 'Merges explanationShort and explanationLong into a single explanation column on questions',

  async run(dataSource: DataSource): Promise<void> {
    await dataSource.query(`
      ALTER TABLE questions ADD COLUMN IF NOT EXISTS explanation TEXT;
    `);

    await dataSource.query(`
      UPDATE questions
      SET explanation = COALESCE("explanationLong", "explanationShort")
      WHERE explanation IS NULL AND ("explanationLong" IS NOT NULL OR "explanationShort" IS NOT NULL);
    `);

    await dataSource.query(`
      ALTER TABLE questions DROP COLUMN IF EXISTS "explanationShort";
      ALTER TABLE questions DROP COLUMN IF EXISTS "explanationLong";
    `);

    console.log('    Merged explanationShort + explanationLong → explanation');
  },
};
