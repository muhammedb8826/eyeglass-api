import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NonStockServicesService } from './non-stock-services.service';
import { NonStockServicesController } from './non-stock-services.controller';
import { NonStockService } from '../entities/non-stock-service.entity';

@Module({
  imports: [TypeOrmModule.forFeature([NonStockService])],
  controllers: [NonStockServicesController],
  providers: [NonStockServicesService],
  exports: [NonStockServicesService],
})
export class NonStockServicesModule {}
