import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SaleItemsService } from './sale-items.service';
import { SaleItemsController } from './sale-items.controller';
import { SaleItems } from 'src/entities/sale-item.entity';
import { BincardModule } from 'src/bincard/bincard.module';
import { OrderItems } from 'src/entities/order-item.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([SaleItems, OrderItems]),
    BincardModule,
  ],
  controllers: [SaleItemsController],
  providers: [SaleItemsService],
})
export class SaleItemsModule {}
