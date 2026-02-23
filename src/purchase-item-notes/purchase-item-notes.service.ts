import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreatePurchaseItemNoteDto } from './dto/create-purchase-item-note.dto';
import { UpdatePurchaseItemNoteDto } from './dto/update-purchase-item-note.dto';
import { PurchaseItemNote } from 'src/entities/purchase-item-note.entity';

@Injectable()
export class PurchaseItemNotesService {
  constructor(
    @InjectRepository(PurchaseItemNote)
    private purchaseItemNoteRepository: Repository<PurchaseItemNote>
  ) {}

  async create(purchaseItemId: string, noteDto: CreatePurchaseItemNoteDto) {
    if (!noteDto || !noteDto.text || !noteDto.userId) {
      throw new Error('Invalid note data');
    }

    const note = this.purchaseItemNoteRepository.create({
      purchaseItemId,
      text: noteDto.text,
      hour: new Date(), // You can modify this logic as needed
      date: new Date(),
      userId: noteDto.userId, // Pass the current user id
    });

    return await this.purchaseItemNoteRepository.save(note);
  }

  async findAll(purchaseItemId: string) {
    return this.purchaseItemNoteRepository.find({
      where: { purchaseItemId },
      relations: {
        user: true,
      },
    });
  }

  async findOne(id: string) {
    const note = await this.purchaseItemNoteRepository.findOne({
      where: { id },
      relations: {
        user: true,
      },
    });

    if (!note) {
      throw new NotFoundException(`PurchaseItemNote with ID ${id} not found`);
    }

    return note;
  }

  async update(id: string, updatePurchaseItemNoteDto: UpdatePurchaseItemNoteDto) {
    const note = await this.purchaseItemNoteRepository.findOne({ where: { id } });
    if (!note) {
      throw new NotFoundException(`PurchaseItemNote with ID ${id} not found`);
    }

    try {
      await this.purchaseItemNoteRepository.update(id, updatePurchaseItemNoteDto);
      return this.purchaseItemNoteRepository.findOne({ where: { id } });
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        throw new ConflictException('Unique constraint failed. Please check your data.');
      }
      throw new Error('An unexpected error occurred.');
    }
  }

  async remove(id: string) {
    const note = await this.purchaseItemNoteRepository.findOne({ where: { id } });
    if (!note) {
      throw new NotFoundException(`PurchaseItemNote with ID ${id} not found`);
    }

    try {
      return await this.purchaseItemNoteRepository.remove(note);
    } catch (error) {
      throw new Error('An unexpected error occurred.');
    }
  }
}
