import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SaleItemNotesService } from './sale-item-notes.service';
import { SaleItemNotesController } from './sale-item-notes.controller';
import { SalesItemNote } from 'src/entities/sales-item-note.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SalesItemNote])],
  controllers: [SaleItemNotesController],
  providers: [SaleItemNotesService],
})
export class SaleItemNotesModule {}
