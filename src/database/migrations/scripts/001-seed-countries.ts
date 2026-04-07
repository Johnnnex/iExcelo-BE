import { DataSource } from 'typeorm';
import { IMigration } from '../migration-runner';
import { Country } from '../../../utils/entities/country.entity';
import { countriesData } from '../../../utils/data/countries.data';

export const migration001: IMigration = {
  name: '001-seed-countries',
  description: 'Seeds the countries table from built-in countries data',

  async run(dataSource: DataSource): Promise<void> {
    const repo = dataSource.getRepository(Country);

    let inserted = 0;
    let skipped = 0;

    for (const data of countriesData) {
      const existing = await repo.findOne({ where: { isoCode: data.isoCode } });
      if (existing) {
        skipped++;
        continue;
      }
      await repo.save(repo.create(data));
      inserted++;
    }

    console.log(
      `    Countries: ${inserted} inserted, ${skipped} already existed`,
    );
  },
};
