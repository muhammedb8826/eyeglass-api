import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';
import { Sale } from 'src/entities/sale.entity';
import { Item } from 'src/entities/item.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Sale, Item])],
  controllers: [SalesController],
  providers: [SalesService],
})
export class SalesModule {}
