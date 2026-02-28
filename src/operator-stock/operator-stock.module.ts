import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OperatorStockService } from './operator-stock.service';
import { OperatorStockController } from './operator-stock.controller';
import { OperatorStock } from 'src/entities/operator-stock.entity';
import { BincardModule } from 'src/bincard/bincard.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([OperatorStock]),
    BincardModule,
  ],
  controllers: [OperatorStockController],
  providers: [OperatorStockService],
  exports: [OperatorStockService],
})
export class OperatorStockModule {}
