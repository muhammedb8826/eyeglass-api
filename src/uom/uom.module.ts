import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UomService } from './uom.service';
import { UomController } from './uom.controller';
import { UOM } from 'src/entities/uom.entity';
import { UnitCategory } from 'src/entities/unit-category.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UOM, UnitCategory])],
  controllers: [UomController],
  providers: [UomService],
  exports: [UomService],
})
export class UomModule {}
