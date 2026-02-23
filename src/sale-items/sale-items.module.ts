import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SaleItemsService } from './sale-items.service';
import { SaleItemsController } from './sale-items.controller';
import { SaleItems } from 'src/entities/sale-item.entity';
import { Item } from 'src/entities/item.entity';
import { OperatorStock } from 'src/entities/operator-stock.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SaleItems, Item, OperatorStock])],
  controllers: [SaleItemsController],
  providers: [SaleItemsService],
})
export class SaleItemsModule {}
