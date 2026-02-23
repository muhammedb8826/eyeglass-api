import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderItemNotesService } from './order-item-notes.service';
import { OrderItemNotesController } from './order-item-notes.controller';
import { OrderItemNotes } from 'src/entities/order-item-notes.entity';


@Module({
  imports: [TypeOrmModule.forFeature([OrderItemNotes])],
  controllers: [OrderItemNotesController],
  providers: [OrderItemNotesService],
})
export class OrderItemNotesModule {}
