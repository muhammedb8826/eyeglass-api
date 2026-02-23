import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PurchasesService } from './purchases.service';
import { PurchasesController } from './purchases.controller';
import { Purchase } from 'src/entities/purchase.entity';
import { Vendor } from 'src/entities/vendor.entity';
import { User } from 'src/entities/user.entity';
import { PurchaseItems } from 'src/entities/purchase-item.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Purchase, PurchaseItems, Vendor, User])],
  controllers: [PurchasesController],
  providers: [PurchasesService],
  exports: [PurchasesService],
})
export class PurchasesModule {}
