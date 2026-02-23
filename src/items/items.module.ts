import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ItemsService } from './items.service';
import { ItemsController } from './items.controller';
import { Item } from '../entities/item.entity';
import { Machine } from '../entities/machine.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Item, Machine])],
  controllers: [ItemsController],
  providers: [ItemsService],
  exports: [ItemsService],
})
export class ItemsModule {}
