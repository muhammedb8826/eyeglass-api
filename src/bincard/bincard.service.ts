import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Bincard, BincardMovementType, BincardReferenceType } from 'src/entities/bincard.entity';

export interface RecordBincardMovementDto {
  itemId: string;
  movementType: BincardMovementType;
  quantity: number;
  balanceAfter: number;
  referenceType: BincardReferenceType;
  referenceId?: string;
  description?: string;
  uomId: string;
}

@Injectable()
export class BincardService {
  constructor(
    @InjectRepository(Bincard)
    private readonly bincardRepository: Repository<Bincard>,
  ) {}

  async recordMovement(dto: RecordBincardMovementDto): Promise<Bincard> {
    const entry = this.bincardRepository.create({
      itemId: dto.itemId,
      movementType: dto.movementType,
      quantity: dto.quantity,
      balanceAfter: dto.balanceAfter,
      referenceType: dto.referenceType,
      referenceId: dto.referenceId ?? null,
      description: dto.description ?? null,
      uomId: dto.uomId,
    });
    return this.bincardRepository.save(entry);
  }

  async findByItemId(
    itemId: string,
    skip: number = 0,
    take: number = 50,
  ): Promise<{ entries: Bincard[]; total: number }> {
    const [entries, total] = await this.bincardRepository.findAndCount({
      where: { itemId },
      relations: ['item', 'uom'],
      order: { createdAt: 'DESC' },
      skip: Number(skip),
      take: Number(take),
    });
    return { entries, total };
  }

  async findOne(id: string): Promise<Bincard> {
    const entry = await this.bincardRepository.findOne({
      where: { id },
      relations: ['item', 'uom'],
    });
    if (!entry) {
      throw new NotFoundException(`Bincard entry with ID ${id} not found`);
    }
    return entry;
  }
}
