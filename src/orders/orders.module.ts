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
import { UOM } from 'src/entities/uom.entity';
import { UnitCategory } from 'src/entities/unit-category.entity';

@Module({
  imports: [
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
      UOM,
      UnitCategory
    ])
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
