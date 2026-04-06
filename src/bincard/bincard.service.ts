import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Bincard, BincardMovementType, BincardReferenceType } from 'src/entities/bincard.entity';

export interface RecordBincardMovementDto {
  itemId: string;
  /** When set, movement is for this base/ADD variant (balanceAfter matches variant qty). */
  itemBaseId?: string | null;
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
      itemBaseId: dto.itemBaseId ?? null,
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
    opts?: { itemBaseId?: string | null },
  ): Promise<{ entries: Bincard[]; total: number }> {
    const where: { itemId: string; itemBaseId?: string | ReturnType<typeof IsNull> } = {
      itemId,
    };
    if (opts?.itemBaseId === null) {
      where.itemBaseId = IsNull();
    } else if (opts?.itemBaseId !== undefined && opts.itemBaseId !== '') {
      where.itemBaseId = opts.itemBaseId;
    }

    const [entries, total] = await this.bincardRepository.findAndCount({
      where,
      relations: ['item', 'itemBase', 'uom'],
      order: { createdAt: 'DESC' },
      skip: Number(skip),
      take: Number(take),
    });
    return { entries, total };
  }

  async findOne(id: string): Promise<Bincard> {
    const entry = await this.bincardRepository.findOne({
      where: { id },
      relations: ['item', 'itemBase', 'uom'],
    });
    if (!entry) {
      throw new NotFoundException(`Bincard entry with ID ${id} not found`);
    }
    return entry;
  }
}
