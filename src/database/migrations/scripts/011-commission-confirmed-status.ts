import { DataSource } from 'typeorm';
import { IMigration } from '../migration-runner';

export const migration011: IMigration = {
  name: '011-commission-confirmed-status',
  description:
    'Adds confirmed value to commissions status enum; migrates existing pending commissions to confirmed',
  async run(dataSource: DataSource): Promise<void> {
    // Add 'confirmed' to the PostgreSQL enum (safe — ADD VALUE IF NOT EXISTS is idempotent)
    await dataSource.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum
          WHERE enumlabel = 'confirmed'
            AND enumtypid = (
              SELECT oid FROM pg_type WHERE typname = 'commissions_status_enum'
            )
        ) THEN
          ALTER TYPE commissions_status_enum ADD VALUE 'confirmed';
        END IF;
      END$$;
    `);

    // Migrate all existing pending commissions to confirmed
    await dataSource.query(`
      UPDATE commissions SET status = 'confirmed' WHERE status = 'pending'
    `);
  },
};
