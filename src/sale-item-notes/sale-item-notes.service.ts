import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateSaleItemNoteDto } from './dto/create-sale-item-note.dto';
import { UpdateSaleItemNoteDto } from './dto/update-sale-item-note.dto';
import { SalesItemNote } from 'src/entities/sales-item-note.entity';

@Injectable()
export class SaleItemNotesService {
  constructor(
    @InjectRepository(SalesItemNote)
    private readonly salesItemNoteRepository: Repository<SalesItemNote>,
  ) {}

  async create(saleItemId: string, noteDto: CreateSaleItemNoteDto) {
    if (!noteDto || !noteDto.text || !noteDto.userId) {
      throw new Error('Invalid note data');
    }

    const salesItemNote = this.salesItemNoteRepository.create({
      saleItemId,
      text: noteDto.text,
      hour: new Date(), // You can modify this logic as needed
      date: new Date(),
      userId: noteDto.userId, // Pass the current user id
    });

    return await this.salesItemNoteRepository.save(salesItemNote);
  }

  async findAll(saleItemId: string) {
    return this.salesItemNoteRepository.find({
      where: { saleItemId },
      relations: ['user'],
    });
  }

  async findOne(id: string) {
    return this.salesItemNoteRepository.findOne({
      where: { id },
      relations: ['user'],
    });
  }

  async update(id: string, updateSaleItemNoteDto: UpdateSaleItemNoteDto) {
    try {
      await this.salesItemNoteRepository.update(id, updateSaleItemNoteDto);
      
      return await this.salesItemNoteRepository.findOne({
        where: { id }
      });
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') { // Unique constraint error code
        throw new ConflictException('Unique constraint failed. Please check your data.');
      }
      throw new Error('An unexpected error occurred.');
    }
  }

  async remove(id: string) {
    try {
      const salesItemNote = await this.salesItemNoteRepository.findOne({
        where: { id }
      });

      if (!salesItemNote) {
        throw new NotFoundException(`SalesItemNote with ID ${id} not found`);
      }

      return await this.salesItemNoteRepository.remove(salesItemNote);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new Error('An unexpected error occurred.');
    }
  }
}
