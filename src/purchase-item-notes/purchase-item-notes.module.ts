import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PurchaseItemNotesService } from './purchase-item-notes.service';
import { PurchaseItemNotesController } from './purchase-item-notes.controller';
import { PurchaseItemNote } from 'src/entities/purchase-item-note.entity';


@Module({
  imports: [TypeOrmModule.forFeature([PurchaseItemNote])],
  controllers: [PurchaseItemNotesController],
  providers: [PurchaseItemNotesService],
  exports: [PurchaseItemNotesService],
})
export class PurchaseItemNotesModule {}
