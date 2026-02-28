import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateSaleItemDto } from './dto/create-sale-item.dto';
import { UpdateSaleItemDto } from './dto/update-sale-item.dto';
import { SaleItems } from 'src/entities/sale-item.entity';
import { Item } from 'src/entities/item.entity';
import { OperatorStock } from 'src/entities/operator-stock.entity';
import { BincardService } from 'src/bincard/bincard.service';
import type { RecordBincardMovementDto } from 'src/bincard/bincard.service';

@Injectable()
export class SaleItemsService {
  constructor(
    @InjectRepository(SaleItems)
    private readonly saleItemRepository: Repository<SaleItems>,
    @InjectRepository(Item)
    private readonly itemRepository: Repository<Item>,
    @InjectRepository(OperatorStock)
    private readonly operatorStockRepository: Repository<OperatorStock>,
    private readonly bincardService: BincardService,
  ) {}

  async create(createSaleItemDto: CreateSaleItemDto) {
    try {
      const saleItem = this.saleItemRepository.create({
        saleId: createSaleItemDto.saleId,
        itemId: createSaleItemDto.itemId,
        uomId: createSaleItemDto.uomId,
        baseUomId: createSaleItemDto.baseUomId,
        unit: parseFloat(createSaleItemDto.unit.toString()),
        quantity: parseFloat(createSaleItemDto.quantity.toString()),
        description: createSaleItemDto.description,
        status: createSaleItemDto.status,
      });

      const savedSaleItem = await this.saleItemRepository.save(saleItem);

      // Schedule status change if initially set to 'Stocked-out'
      // if (savedSaleItem.status === 'Stocked-out') {
      //   this.scheduleStatusChange(savedSaleItem.id, 24 * 60 * 60 * 1000); // 24 hours in milliseconds
      // }

      return savedSaleItem;
    } catch (error) {
      console.error('Error creating Sale Item:', error);

      if (error.code === 'ER_DUP_ENTRY') {
        throw new ConflictException('Unique constraint failed. Please check your data.');
      }

      throw new Error(`An unexpected error occurred: ${error.message}`);
    }
  }

  async findAll(saleId: string) {
    const saleItems = await this.saleItemRepository.find({
      where: { saleId },
      relations: ['sale', 'item', 'saleItemNotes', 'saleItemNotes.user'],
    });
    return saleItems;
  }

  async update(id: string, updateSaleItemDto: UpdateSaleItemDto) {
    let bincardMovement: RecordBincardMovementDto | null = null;

    const result = await this.saleItemRepository.manager.transaction(async (manager) => {
      const saleItem = await manager.findOne(SaleItems, {
        where: { id },
        relations: ['item'],
      });

      if (!saleItem) {
        throw new NotFoundException(`Sale Item with ID ${id} not found`);
      }

      const relatedItem = saleItem.item;
      if (!relatedItem) {
        throw new NotFoundException(`Related item not found for Sale Item with ID ${id}`);
      }

      if (updateSaleItemDto.status === 'Requested' && relatedItem.quantity < updateSaleItemDto.quantity) {
        throw new ConflictException('Requested quantity is more than available quantity');
      }

      let newQuantity = relatedItem.quantity;
      if (updateSaleItemDto.status === 'Cancelled') {
        newQuantity = relatedItem.quantity + saleItem.unit;

        const operatorStock = await manager.findOne(OperatorStock, {
          where: { itemId: relatedItem.id, status: 'Active' },
        });

        if (operatorStock) {
          const balanceAfter = operatorStock.quantity - saleItem.unit;
          await manager.update(OperatorStock, operatorStock.id, {
            quantity: balanceAfter,
          });
          bincardMovement = {
            itemId: relatedItem.id,
            movementType: 'OUT',
            quantity: saleItem.unit,
            balanceAfter,
            referenceType: 'SALE',
            referenceId: saleItem.saleId,
            description: `Sale item cancelled – stock returned`,
            uomId: operatorStock.uomId,
          };
        }
      } else if (updateSaleItemDto.status === 'Stocked-out') {
        newQuantity = relatedItem.quantity - saleItem.unit;

        const operatorStock = await manager.findOne(OperatorStock, {
          where: { itemId: relatedItem.id, status: 'Active' },
        });

        if (operatorStock) {
          const balanceAfter = operatorStock.quantity + saleItem.unit;
          await manager.update(OperatorStock, operatorStock.id, {
            quantity: balanceAfter,
          });
          bincardMovement = {
            itemId: relatedItem.id,
            movementType: 'IN',
            quantity: saleItem.unit,
            balanceAfter,
            referenceType: 'SALE',
            referenceId: saleItem.saleId,
            description: `Stocked-out for sale`,
            uomId: operatorStock.uomId,
          };
        } else {
          await manager.save(OperatorStock, {
            itemId: relatedItem.id,
            uomId: saleItem.uomId,
            quantity: saleItem.unit,
            description: `Stocked-out for Sale Item ${saleItem.id}`,
            status: 'Active',
            baseUomId: saleItem.baseUomId,
            unit: saleItem.unit,
          });
          bincardMovement = {
            itemId: relatedItem.id,
            movementType: 'IN',
            quantity: saleItem.unit,
            balanceAfter: saleItem.unit,
            referenceType: 'SALE',
            referenceId: saleItem.saleId,
            description: `Stocked-out for sale (new operator stock)`,
            uomId: saleItem.uomId,
          };
        }
      }

      if (newQuantity < 0) {
        throw new ConflictException(`Quantity cannot drop below zero for Sale Item with ID ${id}`);
      }

      await manager.update(Item, relatedItem.id, { quantity: newQuantity });

      const updatedSaleItem = await manager.save(SaleItems, {
        id,
        quantity: parseFloat(updateSaleItemDto.quantity.toString()),
        description: updateSaleItemDto.description,
        status: updateSaleItemDto.status,
        unit: parseFloat(updateSaleItemDto.unit.toString()),
      });

      return updatedSaleItem;
    });

    if (bincardMovement) {
      await this.bincardService.recordMovement(bincardMovement);
    }

    return result;
  }

  async remove(id: string) {
    // Fetch the sale item along with associated item
    const saleItem = await this.saleItemRepository.findOne({
      where: { id },
      relations: ['item'],
    });

    if (!saleItem) {
      throw new NotFoundException(`Sale Item with ID ${id} not found`);
    }

    // Fetch the related item
    const relatedItem = saleItem.item;

    if (!relatedItem) {
      throw new NotFoundException(`Related item not found for Sale Item with ID ${id}`);
    }

    // Calculate the new quantity
    const newQuantity = relatedItem.quantity - saleItem.quantity;

    // Ensure that quantity cannot drop below zero
    if (newQuantity < 0) {
      throw new ConflictException(`Quantity cannot drop below zero for Sale Item with ID ${id}`);
    }

    // Update the related item with the new quantity
    await this.itemRepository.update(relatedItem.id, { quantity: newQuantity });

    // Delete the sale item
    const deletedSaleItem = await this.saleItemRepository.remove(saleItem);

    return deletedSaleItem;
  }

  // private async scheduleStatusChange(id: string, delay: number) {
  //   setTimeout(async () => {
  //     const saleItem = await this.saleItemRepository.findOne({
  //       where: { id },
  //       select: ['status'],
  //     });

  //     if (saleItem?.status === 'Stocked-out') {
  //       await this.saleItemRepository.update(id, { status: 'Sent' });
  //     }
  //   }, delay);
  // }
}
