/**
 * TypeORM DataSource for schema migrations (npm run migration:generate/run/revert).
 * This is separate from the NestJS app DataSource — it is only used by the TypeORM CLI.
 *
 * Usage:
//  *   npm run migration:generate -- src/database/migrations/typeorm/AddMyColumn
 *   npm run migration:run
 *   npm run migration:revert
 */
import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { DataSource } from 'typeorm';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export default new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST ?? 'localhost',
  port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
  username: process.env.DATABASE_USER ?? 'postgres',
  password: process.env.DATABASE_PASSWORD ?? 'postgres',
  database: process.env.DATABASE_NAME ?? 'iexcelo',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/typeorm/*{.ts,.js}'],
  migrationsTableName: 'typeorm_migrations',
  synchronize: false,
  ssl:
    process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,
});
