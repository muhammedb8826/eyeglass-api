import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { OrderItemNotesService } from './order-item-notes.service';
import { CreateOrderItemNoteDto } from './dto/create-order-item-note.dto';
import { UpdateOrderItemNoteDto } from './dto/update-order-item-note.dto';

@Controller('order-item-notes')
export class OrderItemNotesController {
  constructor(private readonly orderItemNotesService: OrderItemNotesService) {}

  @Post(':orderItemId')
  async createOrderItemNote(
    @Param('orderItemId') orderItemId: string,
    @Body() createOrderItemNoteDto: CreateOrderItemNoteDto,
  ) {
    return this.orderItemNotesService.create(orderItemId, createOrderItemNoteDto);
  }

  @Get(':orderItemId')
  findAllByOrderItem(@Param('orderItemId') orderItemId: string) {
    return this.orderItemNotesService.findAllByOrderItem(orderItemId);
  }

  @Get('note/:id')
  findOne(@Param('id') id: string) {
    return this.orderItemNotesService.findOne(id);
  }

  @Patch('note/:id')
  update(@Param('id') id: string, @Body() updateOrderItemNoteDto: UpdateOrderItemNoteDto) {
    return this.orderItemNotesService.update(id, updateOrderItemNoteDto);
  }

  @Delete('note/:id')
  remove(@Param('id') id: string) {
    return this.orderItemNotesService.remove(id);
  }
}

