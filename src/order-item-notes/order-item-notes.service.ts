import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateOrderItemNoteDto } from './dto/create-order-item-note.dto';
import { UpdateOrderItemNoteDto } from './dto/update-order-item-note.dto';
import { OrderItemNotes } from 'src/entities/order-item-notes.entity';


@Injectable()
export class OrderItemNotesService {
  constructor(
    @InjectRepository(OrderItemNotes)
    private readonly orderItemNoteRepository: Repository<OrderItemNotes>,
  ) {}

  async create(orderItemId: string, noteDto: CreateOrderItemNoteDto) {
    const orderItemNote = this.orderItemNoteRepository.create({
      orderItemId,
      text: noteDto.text,
      hour: new Date(), // You can modify this logic as needed
      date: new Date(),
      userId: noteDto.userId, // Pass the current user id
    });

    return await this.orderItemNoteRepository.save(orderItemNote);
  }

  async findAllByOrderItem(orderItemId: string) {
    return this.orderItemNoteRepository.find({
      where: { orderItemId },
      relations: ['user'],
    });
  }

  async findOne(id: string) {
    const orderItemNote = await this.orderItemNoteRepository.findOne({
      where: { id },
      relations: ['user']
    });

    if (!orderItemNote) {
      throw new NotFoundException(`Order Item Note with ID ${id} not found`);
    }

    return orderItemNote;
  }

  async update(id: string, updateOrderItemNoteDto: UpdateOrderItemNoteDto) {
    const orderItemNote = await this.orderItemNoteRepository.findOne({
      where: { id }
    });

    if (!orderItemNote) {
      throw new NotFoundException(`Order Item Note with ID ${id} not found`);
    }

    await this.orderItemNoteRepository.update(id, updateOrderItemNoteDto);
    
    return await this.orderItemNoteRepository.findOne({
      where: { id },
      relations: ['user']
    });
  }

  async remove(id: string) {
    const orderItemNote = await this.orderItemNoteRepository.findOne({
      where: { id }
    });

    if (!orderItemNote) {
      throw new NotFoundException(`Order Item Note with ID ${id} not found`);
    }

    await this.orderItemNoteRepository.remove(orderItemNote);
    return { message: `Order Item Note with ID ${id} removed successfully` };
  }
}
