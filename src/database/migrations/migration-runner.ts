import { DataSource, Repository } from 'typeorm';
import { MigrationHistory } from './migration-history.entity';

export interface IMigration {
  name: string;
  description: string;
  run(dataSource: DataSource): Promise<void>;
}

export class MigrationRunner {
  private historyRepo: Repository<MigrationHistory>;

  constructor(private dataSource: DataSource) {
    this.historyRepo = dataSource.getRepository(MigrationHistory);
  }

  async runAll(migrations: IMigration[]): Promise<void> {
    for (const migration of migrations) {
      await this.runOne(migration);
    }
  }

  async runOne(migration: IMigration): Promise<void> {
    const existing = await this.historyRepo.findOne({
      where: { name: migration.name },
    });

    if (existing) {
      console.log(
        `⏭  Skipping  ${migration.name} (already ran at ${existing.ranAt.toISOString()})`,
      );
      return;
    }

    console.log(`▶  Running   ${migration.name}: ${migration.description}`);
    const start = Date.now();

    const record = this.historyRepo.create({
      name: migration.name,
      ranAt: new Date(),
    });

    try {
      await migration.run(this.dataSource);
      record.durationMs = Date.now() - start;
      await this.historyRepo.save(record);
      console.log(`✅ Completed ${migration.name} in ${record.durationMs}ms`);
    } catch (err) {
      record.durationMs = Date.now() - start;
      record.error = err instanceof Error ? err.message : String(err);
      await this.historyRepo.save(record);
      console.error(`❌ Failed    ${migration.name}: ${record.error}`);
      throw err;
    }
  }

  async list(migrations: IMigration[]): Promise<void> {
    const history = await this.historyRepo.find();
    const ran = new Map(history.map((h) => [h.name, h]));

    console.log('\nMigration Status');
    console.log('─'.repeat(64));
    for (const m of migrations) {
      const entry = ran.get(m.name);
      if (entry) {
        const date = entry.ranAt.toISOString().slice(0, 10);
        const dur = entry.durationMs ? ` ${entry.durationMs}ms` : '';
        const err = entry.error ? ` ❌ ${entry.error.slice(0, 60)}` : '';
        console.log(`  ✅ ${m.name.padEnd(40)} ran ${date}${dur}${err}`);
      } else {
        console.log(`  ⏳ ${m.name.padEnd(40)} pending`);
      }
    }
    console.log('─'.repeat(64));
    console.log(`  ${ran.size} ran, ${migrations.length - ran.size} pending\n`);
  }
}
