import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreatePurchaseItemDto } from './dto/create-purchase-item.dto';
import { UpdatePurchaseItemDto } from './dto/update-purchase-item.dto';
import { PurchaseItems } from 'src/entities/purchase-item.entity';
import { BincardService, RecordBincardMovementDto } from 'src/bincard/bincard.service';
import {
  applyInventoryDelta,
  assertItemVariantLineFields,
} from 'src/inventory/item-inventory.util';

@Injectable()
export class PurchaseItemsService {
  constructor(
    @InjectRepository(PurchaseItems)
    private purchaseItemRepository: Repository<PurchaseItems>,
    private readonly bincardService: BincardService,
  ) {}

  private async findDuplicateLine(
    purchaseId: string,
    itemId: string,
    itemBaseId: string | null,
    excludeId?: string,
  ): Promise<PurchaseItems | null> {
    const qb = this.purchaseItemRepository
      .createQueryBuilder('pi')
      .where('pi.purchaseId = :purchaseId', { purchaseId })
      .andWhere('pi.itemId = :itemId', { itemId });
    if (itemBaseId) {
      qb.andWhere('pi.itemBaseId = :itemBaseId', { itemBaseId });
    } else {
      qb.andWhere('pi.itemBaseId IS NULL');
    }
    if (excludeId) {
      qb.andWhere('pi.id != :excludeId', { excludeId });
    }
    return qb.getOne();
  }

  async create(createPurchaseItemDto: CreatePurchaseItemDto) {
    try {
      const itemBaseId = createPurchaseItemDto.itemBaseId ?? null;
      await assertItemVariantLineFields(
        this.purchaseItemRepository.manager,
        createPurchaseItemDto.itemId,
        itemBaseId,
      );

      const dup = await this.findDuplicateLine(
        createPurchaseItemDto.purchaseId,
        createPurchaseItemDto.itemId,
        itemBaseId,
      );
      if (dup) {
        throw new ConflictException(
          'Duplicate purchase line for this item and variant on the same purchase.',
        );
      }

      const purchaseItem = this.purchaseItemRepository.create({
        purchaseId: createPurchaseItemDto.purchaseId,
        itemId: createPurchaseItemDto.itemId,
        itemBaseId,
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

      throw error;
    }
  }

  async findAllPurchaseItems(skip: number, take: number, search?: string, startDate?: string, endDate?: string, item?: string, status?: string) {
    const queryBuilder = this.purchaseItemRepository
      .createQueryBuilder('purchaseItem')
      .leftJoinAndSelect('purchaseItem.purchase', 'purchase')
      .leftJoinAndSelect('purchase.vendor', 'vendor')
      .leftJoinAndSelect('purchaseItem.uoms', 'uoms')
      .leftJoinAndSelect('purchaseItem.item', 'item')
      .leftJoinAndSelect('purchaseItem.itemBase', 'itemBase')
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

    const totalAmountSum = purchaseItems.reduce((sum, row) => sum + row.unitPrice, 0);

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
        itemBase: true,
        purchaseItemNotes: {
          user: true,
        },
      }
    });

    return purchaseItems;
  }

  async update(id: string, updatePurchaseItemDto: UpdatePurchaseItemDto) {
    return this.purchaseItemRepository.manager.transaction(async (manager) => {
      const purchaseItem = await manager.findOne(PurchaseItems, {
        where: { id },
        relations: { item: true },
      });

      if (!purchaseItem) {
        throw new NotFoundException(`Purchase Item with ID ${id} not found`);
      }

      const relatedItem = purchaseItem.item;
      if (!relatedItem) {
        throw new NotFoundException(`Related item not found for Purchase Item with ID ${id}`);
      }

      const prevStatus = purchaseItem.status;
      const newStatus =
        updatePurchaseItemDto.status !== undefined
          ? updatePurchaseItemDto.status
          : prevStatus;

      const itemId =
        updatePurchaseItemDto.itemId !== undefined
          ? updatePurchaseItemDto.itemId
          : purchaseItem.itemId;
      const itemBaseId =
        updatePurchaseItemDto.itemBaseId !== undefined
          ? updatePurchaseItemDto.itemBaseId ?? null
          : purchaseItem.itemBaseId ?? null;

      await assertItemVariantLineFields(manager, itemId, itemBaseId);

      const dup = await this.findDuplicateLine(
        purchaseItem.purchaseId,
        itemId,
        itemBaseId,
        id,
      );
      if (dup) {
        throw new ConflictException(
          'Duplicate purchase line for this item and variant on the same purchase.',
        );
      }

      const unit = Number(purchaseItem.unit);

      let delta = 0;
      if (prevStatus !== 'Received' && newStatus === 'Received') {
        delta = unit;
      } else if (prevStatus === 'Received' && newStatus !== 'Received') {
        delta = -unit;
      }

      let balanceAfter = 0;
      let usedVariant = false;
      if (delta !== 0) {
        const r = await applyInventoryDelta(manager, itemId, itemBaseId, delta);
        balanceAfter = r.balanceAfter;
        usedVariant = r.usedVariant;

        const movement: RecordBincardMovementDto = {
          itemId,
          itemBaseId: usedVariant ? itemBaseId : null,
          movementType: delta > 0 ? 'IN' : 'OUT',
          quantity: Math.abs(delta),
          balanceAfter,
          referenceType: 'PURCHASE',
          referenceId: purchaseItem.purchaseId,
          description:
            delta > 0 ? `Purchase item received` : `Purchase item unreceived – stock adjusted`,
          uomId: purchaseItem.uomId,
        };
        await this.bincardService.recordMovement(movement);
      }

      purchaseItem.itemId = itemId;
      purchaseItem.itemBaseId = itemBaseId;
      if (updatePurchaseItemDto.quantity !== undefined) {
        purchaseItem.quantity = parseFloat(updatePurchaseItemDto.quantity.toString());
      }
      if (updatePurchaseItemDto.unitPrice !== undefined) {
        purchaseItem.unitPrice = parseFloat(updatePurchaseItemDto.unitPrice.toString());
      }
      purchaseItem.status = newStatus;

      await manager.save(PurchaseItems, purchaseItem);

      return manager.findOne(PurchaseItems, {
        where: { id },
        relations: { purchaseItemNotes: true, itemBase: true },
      });
    });
  }

  async remove(id: string) {
    return this.purchaseItemRepository.manager.transaction(async (manager) => {
      const purchaseItem = await manager.findOne(PurchaseItems, { where: { id } });
      if (!purchaseItem) {
        throw new NotFoundException(`Purchase Item with ID ${id} not found`);
      }

      if (purchaseItem.status === 'Received') {
        const itemBaseId = purchaseItem.itemBaseId ?? null;
        const r = await applyInventoryDelta(
          manager,
          purchaseItem.itemId,
          itemBaseId,
          -Number(purchaseItem.unit),
        );
        await this.bincardService.recordMovement({
          itemId: purchaseItem.itemId,
          itemBaseId: r.usedVariant ? itemBaseId : null,
          movementType: 'OUT',
          quantity: Number(purchaseItem.unit),
          balanceAfter: r.balanceAfter,
          referenceType: 'PURCHASE',
          referenceId: purchaseItem.purchaseId,
          description: 'Purchase line removed – receipt reversed',
          uomId: purchaseItem.uomId,
        });
      }

      return manager.remove(PurchaseItems, purchaseItem);
    });
  }
}
