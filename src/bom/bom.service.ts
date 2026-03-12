import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Bom } from 'src/entities/bom.entity';
import { Item } from 'src/entities/item.entity';
import { UOM } from 'src/entities/uom.entity';
import { CreateBomDto } from './dto/create-bom.dto';
import { UpdateBomDto } from './dto/update-bom.dto';

@Injectable()
export class BomService {
  constructor(
    @InjectRepository(Bom)
    private readonly bomRepository: Repository<Bom>,
    @InjectRepository(Item)
    private readonly itemRepository: Repository<Item>,
    @InjectRepository(UOM)
    private readonly uomRepository: Repository<UOM>,
  ) {}

  async create(dto: CreateBomDto) {
    if (dto.parentItemId === dto.componentItemId) {
      throw new ConflictException('Parent item and component item cannot be the same.');
    }

    const parentItem = await this.itemRepository.findOne({ where: { id: dto.parentItemId } });
    if (!parentItem) {
      throw new NotFoundException(`Parent item with ID ${dto.parentItemId} not found`);
    }

    const componentItem = await this.itemRepository.findOne({ where: { id: dto.componentItemId } });
    if (!componentItem) {
      throw new NotFoundException(`Component item with ID ${dto.componentItemId} not found`);
    }

    const uom = await this.uomRepository.findOne({ where: { id: dto.uomId } });
    if (!uom) {
      throw new NotFoundException(`UOM with ID ${dto.uomId} not found`);
    }

    const existing = await this.bomRepository.findOne({
      where: {
        parentItemId: dto.parentItemId,
        componentItemId: dto.componentItemId,
        uomId: dto.uomId,
      },
    });
    if (existing) {
      throw new ConflictException('BOM line for this parent/component/UOM already exists.');
    }

    const bom = this.bomRepository.create(dto);
    return this.bomRepository.save(bom);
  }

  async findAll(parentItemId?: string) {
    const where = parentItemId ? { parentItemId } : {};
    return this.bomRepository.find({
      where,
      relations: ['parentItem', 'componentItem', 'uom'],
      order: { parentItemId: 'ASC' },
    });
  }

  async findOne(id: string) {
    const bom = await this.bomRepository.findOne({
      where: { id },
      relations: ['parentItem', 'componentItem', 'uom'],
    });
    if (!bom) {
      throw new NotFoundException(`BOM line with ID ${id} not found`);
    }
    return bom;
  }

  async update(id: string, dto: UpdateBomDto) {
    const bom = await this.bomRepository.findOne({ where: { id } });
    if (!bom) {
      throw new NotFoundException(`BOM line with ID ${id} not found`);
    }

    if (dto.parentItemId && dto.parentItemId === (dto.componentItemId ?? bom.componentItemId)) {
      throw new ConflictException('Parent item and component item cannot be the same.');
    }

    if (dto.parentItemId) {
      const parentItem = await this.itemRepository.findOne({ where: { id: dto.parentItemId } });
      if (!parentItem) {
        throw new NotFoundException(`Parent item with ID ${dto.parentItemId} not found`);
      }
    }

    if (dto.componentItemId) {
      const componentItem = await this.itemRepository.findOne({ where: { id: dto.componentItemId } });
      if (!componentItem) {
        throw new NotFoundException(`Component item with ID ${dto.componentItemId} not found`);
      }
    }

    if (dto.uomId) {
      const uom = await this.uomRepository.findOne({ where: { id: dto.uomId } });
      if (!uom) {
        throw new NotFoundException(`UOM with ID ${dto.uomId} not found`);
      }
    }

    await this.bomRepository.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: string) {
    const bom = await this.bomRepository.findOne({ where: { id } });
    if (!bom) {
      throw new NotFoundException(`BOM line with ID ${id} not found`);
    }
    await this.bomRepository.remove(bom);
    return { message: `BOM line with ID ${id} removed successfully` };
  }
}

