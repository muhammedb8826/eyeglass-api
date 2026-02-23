import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentTransactionsService } from './payment-transactions.service';
import { PaymentTransactionsController } from './payment-transactions.controller';
import { PaymentTransaction } from 'src/entities/payment-transaction.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PaymentTransaction])],
  controllers: [PaymentTransactionsController],
  providers: [PaymentTransactionsService],
})
export class PaymentTransactionsModule {}
