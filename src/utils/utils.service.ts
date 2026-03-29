import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Country } from './entities/country.entity';
import { countriesData } from './data/countries.data';

@Injectable()
export class UtilsService implements OnModuleInit {
  constructor(
    @InjectRepository(Country)
    private countryRepo: Repository<Country>,
  ) {}

  // Seed countries data on module initialization
  async onModuleInit() {
    const count = await this.countryRepo.count();
    if (count === 0) {
      await this.seedCountries();
    }
  }

  async seedCountries() {
    const countries = countriesData.map((country) =>
      this.countryRepo.create(country),
    );
    await this.countryRepo.save(countries);
  }

  async getAllCountries() {
    return await this.countryRepo.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
  }

  async getCountryByIsoCode(isoCode: string) {
    return await this.countryRepo.findOne({
      where: { isoCode, isActive: true },
    });
  }
}
