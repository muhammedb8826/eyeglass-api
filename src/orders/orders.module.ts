import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { Order } from 'src/entities/order.entity';
import { Pricing } from 'src/entities/pricing.entity';
import { OrderItems } from 'src/entities/order-item.entity';
import { PaymentTerm } from 'src/entities/payment-term.entity';
import { PaymentTransaction } from 'src/entities/payment-transaction.entity';
import { Commission } from 'src/entities/commission.entity';
import { CommissionTransaction } from 'src/entities/commission-transaction.entity';
import { FixedCost } from 'src/entities/fixed-cost.entity';
import { Item } from 'src/entities/item.entity';
import { ItemBase } from 'src/entities/item-base.entity';
import { UOM } from 'src/entities/uom.entity';
import { UnitCategory } from 'src/entities/unit-category.entity';
import { LabToolModule } from 'src/lab-tool/lab-tool.module';
import { NotificationsModule } from 'src/notifications/notifications.module';

@Module({
  imports: [
    LabToolModule,
    NotificationsModule,
    TypeOrmModule.forFeature([
      Order, 
      Pricing, 
      OrderItems, 
      PaymentTerm, 
      PaymentTransaction, 
      Commission, 
      CommissionTransaction,
      FixedCost,
      Item,
      ItemBase,
      UOM,
      UnitCategory
    ])
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
