import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommissionTransactionsService } from './commission-transactions.service';
import { CommissionTransactionsController } from './commission-transactions.controller';
import { CommissionTransaction } from 'src/entities/commission-transaction.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CommissionTransaction])],
  controllers: [CommissionTransactionsController],
  providers: [CommissionTransactionsService],
})
export class CommissionTransactionsModule {}
