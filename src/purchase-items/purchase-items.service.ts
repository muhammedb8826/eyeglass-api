import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreatePurchaseItemDto } from './dto/create-purchase-item.dto';
import { UpdatePurchaseItemDto } from './dto/update-purchase-item.dto';
import { PurchaseItems } from 'src/entities/purchase-item.entity';
import { Item } from 'src/entities/item.entity';

@Injectable()
export class PurchaseItemsService {
  constructor(
    @InjectRepository(PurchaseItems)
    private purchaseItemRepository: Repository<PurchaseItems>,
    @InjectRepository(Item)
    private itemRepository: Repository<Item>
  ) {}

  async create(createPurchaseItemDto: CreatePurchaseItemDto) {
    try {
      const purchaseItem = this.purchaseItemRepository.create({
        purchaseId: createPurchaseItemDto.purchaseId,
        itemId: createPurchaseItemDto.itemId,
        uomId: createPurchaseItemDto.uomId,
        baseUomId: createPurchaseItemDto.baseUomId,
        unit: parseFloat(createPurchaseItemDto.unit.toString()),
        quantity: parseFloat(createPurchaseItemDto.quantity.toString()),
        unitPrice: parseFloat(createPurchaseItemDto.unitPrice.toString()),
        amount: parseFloat(createPurchaseItemDto.amount.toString()),
        description: createPurchaseItemDto.description,
        status: createPurchaseItemDto.status,
      });

      return await this.purchaseItemRepository.save(purchaseItem);
    } catch (error) {
      console.error('Error creating purchase item:', error);

      if (error.code === 'ER_DUP_ENTRY') {
        throw new ConflictException('Unique constraint failed. Please check your data.');
      }

      throw new Error(`An unexpected error occurred: ${error.message}`);
    }
  }

  async findAllPurchaseItems(skip: number, take: number, search?: string, startDate?: string, endDate?: string, item?: string, status?: string) {
    const queryBuilder = this.purchaseItemRepository
      .createQueryBuilder('purchaseItem')
      .leftJoinAndSelect('purchaseItem.purchase', 'purchase')
      .leftJoinAndSelect('purchase.vendor', 'vendor')
      .leftJoinAndSelect('purchaseItem.uoms', 'uoms')
      .leftJoinAndSelect('purchaseItem.item', 'item')
      .leftJoinAndSelect('purchaseItem.purchaseItemNotes', 'purchaseItemNotes')
      .leftJoinAndSelect('purchaseItemNotes.user', 'user')
      .orderBy('purchaseItem.createdAt', 'DESC')
      .skip(+skip)
      .take(+take);

    if (search) {
      queryBuilder.andWhere(
        '(LOWER(purchase.series) LIKE LOWER(:search) OR LOWER(vendor.fullName) LIKE LOWER(:search) OR LOWER(vendor.email) LIKE LOWER(:search) OR LOWER(vendor.phone) LIKE LOWER(:search))',
        { search: `%${search}%` }
      );
    }

    if (startDate && endDate) {
      queryBuilder.andWhere('purchase.orderDate BETWEEN :startDate AND :endDate', {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      });
    }

    if (item) {
      queryBuilder.andWhere('LOWER(item.name) LIKE LOWER(:item)', {
        item: `%${item}%`
      });
    }

    if (status) {
      queryBuilder.andWhere('purchaseItem.status = :status', { status });
    }

    const [purchaseItems, total] = await queryBuilder.getManyAndCount();

    // Calculate total amount sum
    const totalAmountSum = purchaseItems.reduce((sum, item) => sum + item.unitPrice, 0);

    return {
      purchaseItems,
      total,
      totalAmountSum,
    };
  }

  async findAll(purchaseId: string) {
    const purchaseItems = await this.purchaseItemRepository.find({
      where: { purchaseId },
      relations: {
        purchase: true,
        item: true,
        purchaseItemNotes: {
          user: true,
        },
      }
    });

    return purchaseItems;
  }

  async update(id: string, updatePurchaseItemDto: UpdatePurchaseItemDto) {
    try {
      // Fetch the purchase item being updated
      const purchaseItem = await this.purchaseItemRepository.findOne({
        where: { id },
        relations: { item: true }, // Fetch the associated item
      });

      if (!purchaseItem) {
        throw new NotFoundException(`Purchase Item with ID ${id} not found`);
      }

      // Fetch the related item
      const relatedItem = purchaseItem.item;

      if (!relatedItem) {
        throw new NotFoundException(`Related item not found for Purchase Item with ID ${id}`);
      }

      // Calculate the new quantity based on the status
      let newQuantity = relatedItem.quantity;

      switch (updatePurchaseItemDto.status) {
        case 'Cancelled':
          newQuantity -= purchaseItem.unit;
          break;
        case 'Received':
          newQuantity += purchaseItem.unit;
          break;
        // Add other statuses if needed
        default:
          break;
      }

      // Ensure that quantity cannot drop below zero
      if (newQuantity < 0) {
        throw new ConflictException(`Item quantity cannot be less than zero.`);
      }

      // Update the item with the new quantity
      await this.itemRepository.update(
        { id: relatedItem.id },
        { quantity: newQuantity }
      );

      // Update the purchase item
      const updateData = {
        quantity: parseFloat(updatePurchaseItemDto.quantity.toString()),
        unitPrice: parseFloat(updatePurchaseItemDto.unitPrice.toString()),
        status: updatePurchaseItemDto.status,
      };

      await this.purchaseItemRepository.update(id, updateData);

      return this.purchaseItemRepository.findOne({
        where: { id },
        relations: { purchaseItemNotes: true }
      });
    } catch (error) {
      console.log('Error updating purchase item:', error);

      if (error.code === 'ER_DUP_ENTRY') {
        throw new ConflictException('Unique constraint failed. Please check your data.');
      }

      throw new Error('An unexpected error occurred: ' + error.message);
    }
  }

  async remove(id: string) {
    const purchaseItem = await this.purchaseItemRepository.findOne({ where: { id } });
    if (!purchaseItem) {
      throw new NotFoundException(`Purchase Item with ID ${id} not found`);
    }

    return await this.purchaseItemRepository.remove(purchaseItem);
  }
}
