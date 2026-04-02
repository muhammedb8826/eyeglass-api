import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderItemsService } from './order-items.service';
import { OrderItemsController } from './order-items.controller';
import { OrderItems } from 'src/entities/order-item.entity';
import { Order } from 'src/entities/order.entity';
import { PaymentTerm } from 'src/entities/payment-term.entity';
import { OrdersModule } from 'src/orders/orders.module';
import { SalesModule } from 'src/sales/sales.module';
import { NotificationsModule } from 'src/notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([OrderItems, Order, PaymentTerm]),
    OrdersModule,
    SalesModule,
    NotificationsModule,
  ],
  controllers: [OrderItemsController],
  providers: [OrderItemsService],
})
export class OrderItemsModule {}
