import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { Item } from '../entities/item.entity';
import { Machine } from '../entities/machine.entity';

@Injectable()
export class ItemsService {
  constructor(
    @InjectRepository(Item)
    private itemRepository: Repository<Item>,
    @InjectRepository(Machine)
    private machineRepository: Repository<Machine>
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
        }
      }
    });
    
    if (!item) {
      throw new NotFoundException(`Item with ID ${id} not found`);
    }
    return item;
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
