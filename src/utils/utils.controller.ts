import { Controller, Get } from '@nestjs/common';
import { UtilsService } from './utils.service';
import { Public } from '../common/decorators';

@Controller('utils')
export class UtilsController {
  constructor(private readonly utilsService: UtilsService) {}

  @Public()
  @Get('countries')
  async getCountries() {
    const countries = await this.utilsService.getAllCountries();
    return {
      message: 'Countries retrieved successfully',
      data: countries,
    };
  }
}
