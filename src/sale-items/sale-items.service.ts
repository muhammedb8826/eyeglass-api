import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateSaleItemDto } from './dto/create-sale-item.dto';
import { UpdateSaleItemDto } from './dto/update-sale-item.dto';
import { SaleItems } from 'src/entities/sale-item.entity';
import { BincardService, RecordBincardMovementDto } from 'src/bincard/bincard.service';
import { OrderItems } from 'src/entities/order-item.entity';
import { Sale } from 'src/entities/sale.entity';
import { NotificationsService } from 'src/notifications/notifications.service';
import {
  applyInventoryDelta,
  assertItemVariantLineFields,
  assertSaleRequestedAvailability,
} from 'src/inventory/item-inventory.util';
import { User } from 'src/entities/user.entity';
import { PermissionsService } from 'src/permissions/permissions.service';
import {
  assertCanManageApprovals,
  assertCanPerformStoreStockIssue,
  isApprovedLabel,
  isSaleItemStockIssueTransition,
  isStoreRequestLineApprovalToStockIssue,
} from 'src/approvals/approval-authority.util';

@Injectable()
export class SaleItemsService {
  constructor(
    @InjectRepository(SaleItems)
    private readonly saleItemRepository: Repository<SaleItems>,
    @InjectRepository(OrderItems)
    private readonly orderItemsRepository: Repository<OrderItems>,
    private readonly bincardService: BincardService,
    private readonly permissionsService: PermissionsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(createSaleItemDto: CreateSaleItemDto, user: User) {
    if (isApprovedLabel(createSaleItemDto.status)) {
      await assertCanManageApprovals(
        this.permissionsService,
        user,
        'Store request line create with Approved status',
      );
    }
    if (createSaleItemDto.status === 'Stocked-out') {
      await assertCanPerformStoreStockIssue(this.permissionsService, user);
    }

    try {
      const mgr = this.saleItemRepository.manager;
      await assertItemVariantLineFields(
        mgr,
        createSaleItemDto.itemId,
        createSaleItemDto.itemBaseId ?? null,
      );
      if (createSaleItemDto.status === 'Requested') {
        await assertSaleRequestedAvailability(
          mgr,
          createSaleItemDto.itemId,
          createSaleItemDto.itemBaseId ?? null,
          parseFloat(createSaleItemDto.unit.toString()),
        );
      }

      const saleItem = this.saleItemRepository.create({
        saleId: createSaleItemDto.saleId,
        itemId: createSaleItemDto.itemId,
        itemBaseId: createSaleItemDto.itemBaseId ?? null,
        uomId: createSaleItemDto.uomId,
        baseUomId: createSaleItemDto.baseUomId,
        unit: parseFloat(createSaleItemDto.unit.toString()),
        quantity: parseFloat(createSaleItemDto.quantity.toString()),
        description: createSaleItemDto.description,
        status: createSaleItemDto.status,
      });

      const saved = await this.saleItemRepository.save(saleItem);
      const sale = await mgr.findOne(Sale, {
        where: { id: saved.saleId },
        select: ['id', 'series'],
      });
      await this.notificationsService.notifyAllActiveUsers({
        type: 'STORE_REQUEST',
        title: `Store request line added (${sale?.series ?? saved.saleId})`,
        message: `Status: ${saved.status}.`,
        data: {
          saleId: saved.saleId,
          saleItemId: saved.id,
          series: sale?.series,
          status: saved.status,
        },
      });
      return saved;
    } catch (error) {
      console.error('Error creating Sale Item:', error);

      if (error.code === 'ER_DUP_ENTRY') {
        throw new ConflictException('Unique constraint failed. Please check your data.');
      }

      throw error;
    }
  }

  async findAll(saleId: string) {
    const saleItems = await this.saleItemRepository.find({
      where: { saleId },
      relations: ['sale', 'item', 'itemBase', 'saleItemNotes', 'saleItemNotes.user'],
    });
    return saleItems;
  }

  async update(id: string, updateSaleItemDto: UpdateSaleItemDto, user: User) {
    let notifyMeta: {
      saleId: string;
      lineId: string;
      prevStatus: string;
      newStatus: string;
      changed: boolean;
    } | null = null;

    const updatedSaleItem = await this.saleItemRepository.manager.transaction(async (manager) => {
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

      const prevStatus = saleItem.status;
      const newStatus =
        updateSaleItemDto.status !== undefined ? updateSaleItemDto.status : prevStatus;

      if (
        updateSaleItemDto.status !== undefined &&
        isApprovedLabel(newStatus) !== isApprovedLabel(prevStatus) &&
        !isStoreRequestLineApprovalToStockIssue(prevStatus, newStatus)
      ) {
        await assertCanManageApprovals(
          this.permissionsService,
          user,
          'Store request line approval status',
        );
      }
      if (
        updateSaleItemDto.status !== undefined &&
        isSaleItemStockIssueTransition(prevStatus, newStatus)
      ) {
        await assertCanPerformStoreStockIssue(this.permissionsService, user);
      }
      const newUnit =
        updateSaleItemDto.unit !== undefined
          ? parseFloat(updateSaleItemDto.unit.toString())
          : saleItem.unit;
      const newQty =
        updateSaleItemDto.quantity !== undefined
          ? parseFloat(updateSaleItemDto.quantity.toString())
          : saleItem.quantity;

      const itemId =
        updateSaleItemDto.itemId !== undefined ? updateSaleItemDto.itemId : saleItem.itemId;
      const itemBaseId =
        updateSaleItemDto.itemBaseId !== undefined
          ? updateSaleItemDto.itemBaseId ?? null
          : saleItem.itemBaseId ?? null;

      await assertItemVariantLineFields(manager, itemId, itemBaseId);

      if (newStatus === 'Requested') {
        await assertSaleRequestedAvailability(manager, itemId, itemBaseId, newUnit);
      }

      let stockDelta = 0;
      if (prevStatus !== 'Stocked-out' && newStatus === 'Stocked-out') {
        stockDelta = -newUnit;
      } else if (prevStatus === 'Stocked-out' && newStatus !== 'Stocked-out') {
        stockDelta = Number(saleItem.unit);
      }

      let balanceAfter = 0;
      let usedVariant = false;
      if (stockDelta !== 0) {
        const r = await applyInventoryDelta(manager, itemId, itemBaseId, stockDelta);
        balanceAfter = r.balanceAfter;
        usedVariant = r.usedVariant;
      }

      saleItem.itemId = itemId;
      saleItem.itemBaseId = itemBaseId;
      saleItem.quantity = newQty;
      if (updateSaleItemDto.description !== undefined) {
        saleItem.description = updateSaleItemDto.description;
      }
      saleItem.status = newStatus;
      saleItem.unit = newUnit;
      const savedLine = await manager.save(SaleItems, saleItem);

      notifyMeta = {
        saleId: saleItem.saleId,
        lineId: id,
        prevStatus,
        newStatus,
        changed:
          updateSaleItemDto.status !== undefined && prevStatus !== newStatus,
      };

      if (stockDelta !== 0) {
        const movement: RecordBincardMovementDto = {
          itemId,
          itemBaseId: usedVariant ? itemBaseId : null,
          movementType: stockDelta < 0 ? 'OUT' : 'IN',
          quantity: Math.abs(stockDelta),
          balanceAfter,
          referenceType: 'SALE',
          referenceId: saleItem.saleId,
          description:
            stockDelta < 0
              ? 'Stocked-out for production/sale'
              : 'Sale line reverted – stock returned',
          uomId: saleItem.uomId,
        };
        await this.bincardService.recordMovement(movement);
      }

      if (saleItem.orderItemId && newStatus === 'Stocked-out') {
        const relatedOrderItemId = saleItem.orderItemId;
        const relatedSaleItems = await manager.find(SaleItems, {
          where: { orderItemId: relatedOrderItemId },
        });
        const allStockedOut =
          relatedSaleItems.length > 0 &&
          relatedSaleItems.every((si) => si.status === 'Stocked-out');
        if (allStockedOut) {
          await manager.update(
            OrderItems,
            { id: relatedOrderItemId },
            { storeRequestStatus: 'Issued' },
          );
        }
      }

      return savedLine;
    });

    if (notifyMeta?.changed) {
      const sale = await this.saleItemRepository.manager.findOne(Sale, {
        where: { id: notifyMeta.saleId },
        select: ['id', 'series'],
      });
      await this.notificationsService.notifyAllActiveUsers({
        type: 'STORE_REQUEST',
        title: `Store request line updated (${sale?.series ?? notifyMeta.saleId})`,
        message: `Line status: ${notifyMeta.prevStatus} → ${notifyMeta.newStatus}.`,
        data: {
          saleId: notifyMeta.saleId,
          saleItemId: notifyMeta.lineId,
          series: sale?.series,
          previousStatus: notifyMeta.prevStatus,
          status: notifyMeta.newStatus,
        },
      });
    }

    return updatedSaleItem;
  }

  async remove(id: string, user: User) {
    let removedMeta: {
      saleId: string;
      lineId: string;
      status: string;
    } | null = null;

    const removed = await this.saleItemRepository.manager.transaction(async (manager) => {
      const saleItem = await manager.findOne(SaleItems, {
        where: { id },
        relations: ['item'],
      });

      if (!saleItem) {
        throw new NotFoundException(`Sale Item with ID ${id} not found`);
      }

      removedMeta = {
        saleId: saleItem.saleId,
        lineId: id,
        status: saleItem.status,
      };

      if (saleItem.status === 'Stocked-out') {
        await assertCanPerformStoreStockIssue(this.permissionsService, user);
        const itemBaseId = saleItem.itemBaseId ?? null;
        const r = await applyInventoryDelta(
          manager,
          saleItem.itemId,
          itemBaseId,
          Number(saleItem.unit),
        );
        await this.bincardService.recordMovement({
          itemId: saleItem.itemId,
          itemBaseId: r.usedVariant ? itemBaseId : null,
          movementType: 'IN',
          quantity: Number(saleItem.unit),
          balanceAfter: r.balanceAfter,
          referenceType: 'SALE',
          referenceId: saleItem.saleId,
          description: 'Sale item removed – stock returned',
          uomId: saleItem.uomId,
        });
      }

      return manager.remove(SaleItems, saleItem);
    });

    if (removedMeta) {
      const sale = await this.saleItemRepository.manager.findOne(Sale, {
        where: { id: removedMeta.saleId },
        select: ['id', 'series'],
      });
      await this.notificationsService.notifyAllActiveUsers({
        type: 'STORE_REQUEST',
        title: `Store request line removed (${sale?.series ?? removedMeta.saleId})`,
        message: `Removed line was status "${removedMeta.status}".`,
        data: {
          saleId: removedMeta.saleId,
          saleItemId: removedMeta.lineId,
          series: sale?.series,
          status: removedMeta.status,
        },
      });
    }

    return removed;
  }
}
