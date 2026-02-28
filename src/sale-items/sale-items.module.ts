import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SaleItemsService } from './sale-items.service';
import { SaleItemsController } from './sale-items.controller';
import { SaleItems } from 'src/entities/sale-item.entity';
import { Item } from 'src/entities/item.entity';
import { OperatorStock } from 'src/entities/operator-stock.entity';
import { BincardModule } from 'src/bincard/bincard.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SaleItems, Item, OperatorStock]),
    BincardModule,
  ],
  controllers: [SaleItemsController],
  providers: [SaleItemsService],
})
export class SaleItemsModule {}
