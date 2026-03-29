import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UtilsController } from './utils.controller';
import { UtilsService } from './utils.service';
import { Country } from './entities/country.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Country])],
  controllers: [UtilsController],
  providers: [UtilsService],
  exports: [UtilsService],
})
export class UtilsModule {}
