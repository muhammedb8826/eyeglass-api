import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, IsNull } from 'typeorm';
import { CreateItemDto } from './dto/create-item.dto';
import { CreateItemBaseDto } from './dto/create-item-base.dto';
import { UpdateItemBaseDto } from './dto/update-item-base.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { Item } from '../entities/item.entity';
import { ItemBase } from '../entities/item-base.entity';
import { Machine } from '../entities/machine.entity';
import { Pricing } from '../entities/pricing.entity';

@Injectable()
export class ItemsService {
  constructor(
    @InjectRepository(Item)
    private itemRepository: Repository<Item>,
    @InjectRepository(ItemBase)
    private itemBaseRepository: Repository<ItemBase>,
    @InjectRepository(Machine)
    private machineRepository: Repository<Machine>,
    @InjectRepository(Pricing)
    private pricingRepository: Repository<Pricing>,
  ) {}

  async create(createItemDto: CreateItemDto) {
    if (!createItemDto.machineId) {
      throw new ConflictException('Machine ID is required.');
    }
  
    // Check if the machine exists
    const machineExists = await this.machineRepository.findOne({
      where: { id: createItemDto.machineId },
    });
  
    if (!machineExists) {
      throw new ConflictException('Machine ID does not exist.');
    }
  
    // Check if an item with the same name or code already exists
    const existingItem = await this.itemRepository.findOne({
      where: createItemDto.itemCode
        ? [
            { name: ILike(createItemDto.name) },
            { itemCode: createItemDto.itemCode },
          ]
        : { name: ILike(createItemDto.name) },
    });
  
    if (existingItem) {
      throw new ConflictException('An item with this name already exists.');
    }

    try {
      const item = this.itemRepository.create({
        itemCode: createItemDto.itemCode,
        name: createItemDto.name,
        description: createItemDto.description || '',
        reorder_level: createItemDto.reorder_level || 0,
        initial_stock: createItemDto.initial_stock || 0,
        updated_initial_stock: createItemDto.updated_initial_stock || 0,
        can_be_sold: createItemDto.can_be_sold !== undefined ? createItemDto.can_be_sold : false,
        can_be_purchased: createItemDto.can_be_purchased !== undefined ? createItemDto.can_be_purchased : false,
        quantity: createItemDto.quantity || 0,
        defaultUomId: createItemDto.defaultUomId,
        purchaseUomId: createItemDto.purchaseUomId,
        machineId: createItemDto.machineId,
        unitCategoryId: createItemDto.unitCategoryId,
      });

      return await this.itemRepository.save(item);
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        throw new ConflictException('An item with this name already exists.');
      } else if (error.code === 'ER_NO_REFERENCED_ROW_2') {
        throw new ConflictException('Foreign key constraint failed.');
      } else {
        console.log(error);
        throw new Error('An unexpected error occurred.');
      }
    }
  }

  async findAll(skip: number, take: number, search?: string) {
    const queryBuilder = this.itemRepository
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.machine', 'machine')
      .leftJoinAndSelect('item.defaultUom', 'defaultUom')
      .leftJoinAndSelect('item.purchaseUom', 'purchaseUom')
      .leftJoinAndSelect('item.unitCategory', 'unitCategory')
      .leftJoinAndSelect('unitCategory.uoms', 'unitCategoryUoms')
      .orderBy('item.createdAt', 'DESC')
      .skip(Number(skip))
      .take(Number(take));

    if (search) {
      queryBuilder.where(
        '(LOWER(item.name) LIKE LOWER(:search) OR LOWER(item.description) LIKE LOWER(:search))',
        { search: `%${search}%` }
      );
    }

    const [items, total] = await queryBuilder.getManyAndCount();
    
    return {
      items,
      total
    };
  }

  async findAllItems() {
    return this.itemRepository.find({
      relations: {
        machine: true,
        defaultUom: true,
        purchaseUom: true,
        unitCategory: {
          uoms: true
        }
      }
    });
  }



  async findOne(id: string) {
    const item = await this.itemRepository.findOne({
      where: { id },
      relations: {
        machine: true,
        defaultUom: true,
        purchaseUom: true,
        unitCategory: {
          uoms: true
        },
        itemBases: true,
      }
    });

    if (!item) {
      throw new NotFoundException(`Item with ID ${id} not found`);
    }
    return item;
  }

  /** Add a base variant for an item (e.g. 3221: 350+25 → baseCode "350", addPower 2.5). */
  async addBase(itemId: string, dto: CreateItemBaseDto): Promise<ItemBase> {
    const item = await this.itemRepository.findOne({ where: { id: itemId } });
    if (!item) {
      throw new NotFoundException(`Item with ID ${itemId} not found`);
    }
    const existing = await this.itemBaseRepository.findOne({
      where: { itemId, baseCode: dto.baseCode.trim(), addPower: dto.addPower },
    });
    if (existing) {
      throw new ConflictException(
        `This item already has a base with baseCode "${dto.baseCode}" and addPower ${dto.addPower}`,
      );
    }
    const base = this.itemBaseRepository.create({
      itemId,
      baseCode: dto.baseCode.trim(),
      addPower: dto.addPower,
    });
    return this.itemBaseRepository.save(base);
  }

  /** Get bases for an item (e.g. 3221 → 350^+2.5, 575^+2.5). Returns empty array if item has no bases. */
  async findBasesByItemId(itemId: string) {
    const item = await this.itemRepository.findOne({ where: { id: itemId } });
    if (!item) {
      throw new NotFoundException(`Item with ID ${itemId} not found`);
    }
    return this.itemBaseRepository.find({
      where: { itemId },
      order: { baseCode: 'ASC', addPower: 'ASC' },
    });
  }

  /** Update a base variant for an item. */
  async updateBase(itemId: string, baseId: string, dto: UpdateItemBaseDto): Promise<ItemBase> {
    const base = await this.itemBaseRepository.findOne({ where: { id: baseId, itemId } });
    if (!base) {
      throw new NotFoundException(`Base with ID ${baseId} for this item not found`);
    }
    if (dto.baseCode !== undefined) {
      base.baseCode = dto.baseCode.trim();
    }
    if (dto.addPower !== undefined) {
      base.addPower = dto.addPower;
    }
    const existing = await this.itemBaseRepository.findOne({
      where: { itemId, baseCode: base.baseCode, addPower: base.addPower },
    });
    if (existing && existing.id !== baseId) {
      throw new ConflictException(
        `This item already has a base with baseCode "${base.baseCode}" and addPower ${base.addPower}`,
      );
    }
    return this.itemBaseRepository.save(base);
  }

  /** Delete a base variant from an item. Fails if pricing or order items reference this base (DB constraint). */
  async deleteBase(itemId: string, baseId: string): Promise<void> {
    const base = await this.itemBaseRepository.findOne({ where: { id: baseId, itemId } });
    if (!base) {
      throw new NotFoundException(`Base with ID ${baseId} for this item not found`);
    }
    await this.itemBaseRepository.delete(baseId);
  }

  /**
   * When item is selected for an order line: return pricing (item-only) and tool (machine).
   * Frontend can use this to check pricing and required machine before creating the order item.
   */
  async getOrderInfo(itemId: string, itemBaseId?: string | null) {
    const item = await this.itemRepository.findOne({
      where: { id: itemId },
      relations: { machine: true, defaultUom: true, unitCategory: true, itemBases: true },
    });
    if (!item) {
      throw new NotFoundException(`Item with ID ${itemId} not found`);
    }
    const pricing = await this.pricingRepository.findOne({
      where: {
        itemId,
        ...(itemBaseId ? { itemBaseId } : { itemBaseId: IsNull() }),
        serviceId: IsNull(),
        nonStockServiceId: IsNull(),
      },
    });
    return {
      item,
      pricing: pricing ?? null,
      machine: item.machine ?? null,
    };
  }

  async update(id: string, updateItemDto: UpdateItemDto) {
    const item = await this.itemRepository.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException(`Item with ID ${id} not found`);
    }
  
    const updateData: any = {
      name: updateItemDto.name,
      description: updateItemDto.description,
      reorder_level: updateItemDto.reorder_level,
      initial_stock: updateItemDto.initial_stock,
      updated_initial_stock: updateItemDto.updated_initial_stock,
      can_be_sold: updateItemDto.can_be_sold,
      can_be_purchased: updateItemDto.can_be_purchased,
      quantity: updateItemDto.quantity,
    };

    if (updateItemDto.defaultUomId) updateData.defaultUomId = updateItemDto.defaultUomId;
    if (updateItemDto.purchaseUomId) updateData.purchaseUomId = updateItemDto.purchaseUomId;
    if (updateItemDto.machineId) updateData.machineId = updateItemDto.machineId;
    if (updateItemDto.unitCategoryId) updateData.unitCategoryId = updateItemDto.unitCategoryId;
  
    try {
      await this.itemRepository.update(id, updateData);
      return this.findOne(id);
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        throw new ConflictException('Unique constraint failed. Please check your data.');
      } else if (error.code === 'ER_NO_REFERENCED_ROW_2') {
        throw new ConflictException('Foreign key constraint failed.');
      } else {
        throw new Error('An unexpected error occurred.');
      }
    }
  }

  async remove(id: string) {
    const item = await this.itemRepository.findOne({
      where: { id }
    });
  
    if (!item) {
      throw new NotFoundException(`Item with ID ${id} not found`);
    }
  
    try {
      return await this.itemRepository.remove(item);
    } catch (error) {
      if (error.code === 'ER_ROW_IS_REFERENCED_2') {
        throw new BadRequestException('Cannot delete item due to existing dependencies. Please remove associated data first.');
      }
      throw error;
    }
  }
}
