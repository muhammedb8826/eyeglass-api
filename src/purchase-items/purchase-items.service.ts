import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreatePurchaseItemDto } from './dto/create-purchase-item.dto';
import { UpdatePurchaseItemDto } from './dto/update-purchase-item.dto';
import { PurchaseItems } from 'src/entities/purchase-item.entity';
import { Purchase } from 'src/entities/purchase.entity';
import { BincardService, RecordBincardMovementDto } from 'src/bincard/bincard.service';
import {
  applyInventoryDelta,
  assertItemVariantLineFields,
} from 'src/inventory/item-inventory.util';
import {
  assertCanReceivePurchaseIntoStock,
  isPurchaseItemInventoryTransition,
} from 'src/approvals/approval-authority.util';
import { User } from 'src/entities/user.entity';
import { PermissionsService } from 'src/permissions/permissions.service';
import { NotificationsService } from 'src/notifications/notifications.service';

@Injectable()
export class PurchaseItemsService {
  constructor(
    @InjectRepository(PurchaseItems)
    private purchaseItemRepository: Repository<PurchaseItems>,
    private readonly bincardService: BincardService,
    private readonly permissionsService: PermissionsService,
    private readonly notificationsService: NotificationsService,
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

  async create(createPurchaseItemDto: CreatePurchaseItemDto, user: User) {
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

      if (createPurchaseItemDto.status === 'Received') {
        await assertCanReceivePurchaseIntoStock(this.permissionsService, user);
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

      const saved = await this.purchaseItemRepository.save(purchaseItem);
      const po = await this.purchaseItemRepository.manager.findOne(Purchase, {
        where: { id: createPurchaseItemDto.purchaseId },
        select: ['id', 'series'],
      });
      await this.notificationsService.notifyAllActiveUsers({
        type: 'PURCHASE',
        title: `Purchase line added (${po?.series ?? createPurchaseItemDto.purchaseId})`,
        message: `Status: ${saved.status}.`,
        data: {
          purchaseId: createPurchaseItemDto.purchaseId,
          purchaseItemId: saved.id,
          series: po?.series,
          status: saved.status,
        },
      });
      return saved;
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

  async update(id: string, updatePurchaseItemDto: UpdatePurchaseItemDto, user: User) {
    let notifyMeta: {
      purchaseId: string;
      lineId: string;
      prevStatus: string;
      newStatus: string;
      changed: boolean;
    } | null = null;

    const result = await this.purchaseItemRepository.manager.transaction(async (manager) => {
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

      if (isPurchaseItemInventoryTransition(prevStatus, newStatus)) {
        await assertCanReceivePurchaseIntoStock(this.permissionsService, user);
      }

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

      notifyMeta = {
        purchaseId: purchaseItem.purchaseId,
        lineId: id,
        prevStatus,
        newStatus,
        changed:
          updatePurchaseItemDto.status !== undefined &&
          prevStatus !== newStatus,
      };

      return manager.findOne(PurchaseItems, {
        where: { id },
        relations: { purchaseItemNotes: true, itemBase: true },
      });
    });

    if (notifyMeta?.changed) {
      const po = await this.purchaseItemRepository.manager.findOne(Purchase, {
        where: { id: notifyMeta.purchaseId },
        select: ['id', 'series'],
      });
      await this.notificationsService.notifyAllActiveUsers({
        type: 'PURCHASE',
        title: `Purchase line updated (${po?.series ?? notifyMeta.purchaseId})`,
        message: `Line status: ${notifyMeta.prevStatus} → ${notifyMeta.newStatus}.`,
        data: {
          purchaseId: notifyMeta.purchaseId,
          purchaseItemId: notifyMeta.lineId,
          series: po?.series,
          previousStatus: notifyMeta.prevStatus,
          status: notifyMeta.newStatus,
        },
      });
    }

    return result;
  }

  async remove(id: string, user: User) {
    let removedMeta: {
      purchaseId: string;
      lineId: string;
      status: string;
    } | null = null;

    const removed = await this.purchaseItemRepository.manager.transaction(async (manager) => {
      const purchaseItem = await manager.findOne(PurchaseItems, { where: { id } });
      if (!purchaseItem) {
        throw new NotFoundException(`Purchase Item with ID ${id} not found`);
      }

      removedMeta = {
        purchaseId: purchaseItem.purchaseId,
        lineId: id,
        status: purchaseItem.status,
      };

      if (purchaseItem.status === 'Received') {
        await assertCanReceivePurchaseIntoStock(this.permissionsService, user);
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

    if (removedMeta) {
      const po = await this.purchaseItemRepository.manager.findOne(Purchase, {
        where: { id: removedMeta.purchaseId },
        select: ['id', 'series'],
      });
      await this.notificationsService.notifyAllActiveUsers({
        type: 'PURCHASE',
        title: `Purchase line removed (${po?.series ?? removedMeta.purchaseId})`,
        message: `Removed line was status "${removedMeta.status}".`,
        data: {
          purchaseId: removedMeta.purchaseId,
          purchaseItemId: removedMeta.lineId,
          series: po?.series,
          status: removedMeta.status,
        },
      });
    }

    return removed;
  }
}
