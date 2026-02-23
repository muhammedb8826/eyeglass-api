import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { Sale } from 'src/entities/sale.entity';
import { Item } from 'src/entities/item.entity';

@Injectable()
export class SalesService {
  constructor(
    @InjectRepository(Sale)
    private readonly saleRepository: Repository<Sale>,
    @InjectRepository(Item)
    private readonly itemRepository: Repository<Item>,
  ) {}

  async create(createSaleDto: CreateSaleDto) {
    const { saleItems, ...saleData } = createSaleDto;

    try {
      // Fetch the relevant items from the database
      for (const item of saleItems) {
        const relatedItem = await this.itemRepository.findOne({
          where: { id: item.itemId },
          select: ['quantity', 'name'],
        });

        if (!relatedItem) {
          throw new NotFoundException(`Item with ID ${item.itemId} not found.`);
        }

        if (item.status === 'Requested' && relatedItem.quantity < item.unit) {
          throw new ConflictException(`Requested quantity is more than available quantity for item "${relatedItem.name}"`);
        }
      }

      // Create the sale first
      const sale = this.saleRepository.create({
        series: saleData.series,
        operatorId: saleData.operatorId,
        status: saleData.status,
        orderDate: new Date(saleData.orderDate),
        totalQuantity: parseFloat(saleData.totalQuantity.toString()),
        note: saleData.note,
      });

      const savedSale = await this.saleRepository.save(sale);

      // Create sale items separately
      const saleItemsToCreate = saleItems.map(item => ({
        saleId: savedSale.id,
        itemId: item.itemId,
        uomId: item.uomId,
        quantity: item.quantity,
        description: item.description,
        status: item.status,
        unit: parseFloat(item.unit.toString()),
        baseUomId: item.baseUomId,
      }));

      // Insert sale items
      await this.saleRepository
        .createQueryBuilder()
        .insert()
        .into('sale_items')
        .values(saleItemsToCreate)
        .execute();

      // Return the complete sale with items
      return await this.saleRepository.findOne({
        where: { id: savedSale.id },
        relations: ['saleItems', 'operator'],
      });
    } catch (error) {
      console.error("Error creating sale:", error);

      // Re-throw the ConflictException as is
      if (error instanceof ConflictException || error instanceof NotFoundException) {
        throw error;
      }

      // For any other unexpected errors, rethrow the original error
      throw new ConflictException(`An unexpected error occurred: ${error.message}`);
    }
  }

  async findAll(skip: number, take: number) {
    const [sales, total] = await this.saleRepository.findAndCount({
      skip: Number(skip),
      take: Number(take),
      order: {
        createdAt: 'DESC'
      },
      relations: ['saleItems', 'operator'],
    });

    return {
      sales,
      total
    };
  }

  async findAllSales() {
    return this.saleRepository.find({
      relations: ['saleItems', 'operator'],
    });
  }

  findOne(id: string) {
    return this.saleRepository.findOne({
      where: { id },
      relations: ['saleItems', 'operator'],
    });
  }

  async update(id: string, updateSaleDto: UpdateSaleDto) {
    const { saleItems, ...saleData } = updateSaleDto;

    // Fetch the existing sale and its items
    const existingSale = await this.saleRepository.findOne({
      where: { id },
      relations: ['saleItems'],
    });

    if (!existingSale) {
      throw new NotFoundException(`Sale with ID ${id} not found`);
    }

    // Extract existing item IDs for comparison
    const existingItemIds = existingSale.saleItems.map(item => item.id);
    const newItemIds = updateSaleDto.saleItems.map(item => item.id);

    // Determine which items need to be deleted (those not in the new items list)
    const itemsToDelete = existingItemIds.filter(id => !newItemIds.includes(id));

    try {
      // Validate each sale item
      for (const item of saleItems) {
        const relatedItem = await this.itemRepository.findOne({
          where: { id: item.itemId },
          select: ['quantity', 'name'],
        });

        if (!relatedItem) {
          throw new NotFoundException(`Item with ID ${item.itemId} not found.`);
        }

        if (item.status === 'Requested' && relatedItem.quantity < item.unit) {
          throw new ConflictException(`Requested quantity is more than available quantity for item "${relatedItem.name}"`);
        }
      }

      // Delete items that are no longer present in the update request
      if (itemsToDelete.length > 0) {
        await this.saleRepository
          .createQueryBuilder()
          .delete()
          .from('sale_items')
          .where('id IN (:...ids)', { ids: itemsToDelete })
          .execute();
      }

      // Update the sale data
      await this.saleRepository.update(id, {
        ...saleData,
        orderDate: saleData.orderDate ? new Date(saleData.orderDate) : undefined,
        totalQuantity: saleData.totalQuantity ? parseFloat(saleData.totalQuantity.toString()) : undefined,
      });

      // Update or create sale items
      for (const item of updateSaleDto.saleItems) {
        if (item.id) {
          // Update existing item
          await this.saleRepository
            .createQueryBuilder()
            .update('sale_items')
            .set({
              itemId: item.itemId,
              uomId: item.uomId,
              quantity: item.quantity,
              description: item.description,
              status: item.status,
              baseUomId: item.baseUomId,
              unit: parseFloat(item.unit.toString()),
            })
            .where('id = :id', { id: item.id })
            .execute();
        } else {
          // Create new item
          await this.saleRepository
            .createQueryBuilder()
            .insert()
            .into('sale_items')
            .values({
              saleId: id,
              itemId: item.itemId,
              uomId: item.uomId,
              quantity: item.quantity,
              description: item.description,
              status: item.status,
              baseUomId: item.baseUomId,
              unit: parseFloat(item.unit.toString()),
            })
            .execute();
        }
      }

      // Return the updated sale
      return await this.saleRepository.findOne({
        where: { id },
        relations: ['saleItems', 'operator'],
      });
    } catch (error) {
      console.error("Error updating sale:", error);

      // Re-throw the ConflictException as is
      if (error instanceof ConflictException || error instanceof NotFoundException) {
        throw error;
      }

      // For any other unexpected errors, rethrow the original error
      throw new ConflictException(`An unexpected error occurred: ${error.message}`);
    }
  }

  async remove(id: string) {
    const sale = await this.saleRepository.findOne({
      where: { id },
      relations: ['saleItems'],
    });

    if (!sale) {
      throw new Error(`Sale with ID ${id} not found`);
    }

    if (sale.saleItems.length > 0) {
      throw new ConflictException('Sale has items and cannot be deleted');
    }

    const deletedSale = await this.saleRepository.remove(sale);

    return deletedSale;
  }
}
