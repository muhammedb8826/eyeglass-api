import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PurchaseItemsService } from './purchase-items.service';
import { PurchaseItemsController } from './purchase-items.controller';
import { PurchaseItems } from 'src/entities/purchase-item.entity';
import { PurchaseItemNote } from 'src/entities/purchase-item-note.entity';
import { BincardModule } from 'src/bincard/bincard.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PurchaseItems, PurchaseItemNote]),
    BincardModule,
  ],
  controllers: [PurchaseItemsController],
  providers: [PurchaseItemsService],
  exports: [PurchaseItemsService],
})
export class PurchaseItemsModule {}
