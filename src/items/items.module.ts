import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ItemsService } from './items.service';
import { ItemsController } from './items.controller';
import { Item } from '../entities/item.entity';
import { ItemBase } from '../entities/item-base.entity';
import { Machine } from '../entities/machine.entity';
import { Pricing } from '../entities/pricing.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Item, ItemBase, Machine, Pricing])],
  controllers: [ItemsController],
  providers: [ItemsService],
  exports: [ItemsService],
})
export class ItemsModule {}
