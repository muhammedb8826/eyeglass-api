import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bom } from 'src/entities/bom.entity';
import { Item } from 'src/entities/item.entity';
import { UOM } from 'src/entities/uom.entity';
import { BomService } from './bom.service';
import { BomController } from './bom.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Bom, Item, UOM])],
  controllers: [BomController],
  providers: [BomService],
  exports: [BomService],
})
export class BomModule {}

