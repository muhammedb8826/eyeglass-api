import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OperatorStockService } from './operator-stock.service';
import { OperatorStockController } from './operator-stock.controller';
import { OperatorStock } from 'src/entities/operator-stock.entity';


@Module({
  imports: [TypeOrmModule.forFeature([OperatorStock])],
  controllers: [OperatorStockController],
  providers: [OperatorStockService],
  exports: [OperatorStockService],
})
export class OperatorStockModule {}
