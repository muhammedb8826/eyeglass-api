import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderItemsService } from './order-items.service';
import { OrderItemsController } from './order-items.controller';
import { OrderItems } from 'src/entities/order-item.entity';
import { Order } from 'src/entities/order.entity';
import { OperatorStock } from 'src/entities/operator-stock.entity';
import { PaymentTerm } from 'src/entities/payment-term.entity';
import { BincardModule } from 'src/bincard/bincard.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([OrderItems, Order, OperatorStock, PaymentTerm]),
    BincardModule,
  ],
  controllers: [OrderItemsController],
  providers: [OrderItemsService],
})
export class OrderItemsModule {}
