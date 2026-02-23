import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PurchaseItemsService } from './purchase-items.service';
import { PurchaseItemsController } from './purchase-items.controller';
import { PurchaseItems } from 'src/entities/purchase-item.entity';
import { PurchaseItemNote } from 'src/entities/purchase-item-note.entity';
import { Item } from 'src/entities/item.entity';


@Module({
  imports: [TypeOrmModule.forFeature([PurchaseItems, PurchaseItemNote, Item])],
  controllers: [PurchaseItemsController],
  providers: [PurchaseItemsService],
  exports: [PurchaseItemsService],
})
export class PurchaseItemsModule {}
