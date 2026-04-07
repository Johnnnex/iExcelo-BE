import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Country } from './entities/country.entity';

@Injectable()
export class UtilsService {
  constructor(
    @InjectRepository(Country)
    private countryRepo: Repository<Country>,
  ) {}

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
