import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  assertItemVariantLineFields,
  assertSaleRequestedAvailability,
} from 'src/inventory/item-inventory.util';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { Sale } from 'src/entities/sale.entity';
import { Item } from 'src/entities/item.entity';
import { User } from 'src/entities/user.entity';
import { randomUUID } from 'crypto';
import { PermissionsService } from 'src/permissions/permissions.service';
import {
  assertCanManageApprovals,
  assertCanPerformStoreStockIssue,
  isApprovedLabel,
  isSaleItemStockIssueTransition,
  isStoreRequestLineApprovalToStockIssue,
} from 'src/approvals/approval-authority.util';
import { NotificationsService } from 'src/notifications/notifications.service';

@Injectable()
export class SalesService {
  constructor(
    @InjectRepository(Sale)
    private readonly saleRepository: Repository<Sale>,
    @InjectRepository(Item)
    private readonly itemRepository: Repository<Item>,
    private readonly permissionsService: PermissionsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(createSaleDto: CreateSaleDto, user?: User | null) {
    const { saleItems, ...saleData } = createSaleDto;

    if (
      isApprovedLabel(saleData.status) ||
      saleItems.some((it) => isApprovedLabel(it.status))
    ) {
      await assertCanManageApprovals(
        this.permissionsService,
        user,
        'Store request (sale) create with Approved status',
      );
    }
    if (saleItems.some((it) => it.status === 'Stocked-out')) {
      await assertCanPerformStoreStockIssue(this.permissionsService, user);
    }

    try {
      const mgr = this.itemRepository.manager;
      for (const item of saleItems) {
        const itemBaseId = item.itemBaseId ?? null;
        await assertItemVariantLineFields(mgr, item.itemId, itemBaseId);
        if (item.status === 'Requested') {
          await assertSaleRequestedAvailability(
            mgr,
            item.itemId,
            itemBaseId,
            parseFloat(item.unit.toString()),
          );
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
        id: randomUUID(),
        saleId: savedSale.id,
        itemId: item.itemId,
        itemBaseId: item.itemBaseId ?? null,
        uomId: item.uomId,
        quantity: item.quantity,
        description: item.description,
        status: item.status,
        unit: parseFloat(item.unit.toString()),
        baseUomId: item.baseUomId,
        orderItemId: (item as any).orderItemId ?? null,
      }));

      // Insert sale items
      await this.saleRepository
        .createQueryBuilder()
        .insert()
        .into('sale_items')
        .values(saleItemsToCreate)
        .execute();

      const created = await this.saleRepository.findOne({
        where: { id: savedSale.id },
        relations: ['saleItems', 'operator'],
      });
      await this.notificationsService.notifyAllActiveUsers({
        type: 'STORE_REQUEST',
        title: `Store request created (${saleData.series})`,
        message: `Status ${saleData.status}. ${saleItems.length} line(s).`,
        data: {
          saleId: savedSale.id,
          series: saleData.series,
          status: saleData.status,
          operatorId: saleData.operatorId ?? null,
          lineCount: saleItems.length,
        },
      });
      return created;
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

  async update(id: string, updateSaleDto: UpdateSaleDto, user: User) {
    const { saleItems, ...saleData } = updateSaleDto;

    // Fetch the existing sale and its items
    const existingSale = await this.saleRepository.findOne({
      where: { id },
      relations: ['saleItems'],
    });

    if (!existingSale) {
      throw new NotFoundException(`Sale with ID ${id} not found`);
    }

    if (saleData.status !== undefined) {
      if (
        isApprovedLabel(saleData.status) !==
        isApprovedLabel(existingSale.status)
      ) {
        await assertCanManageApprovals(
          this.permissionsService,
          user,
          'Store request (sale) header approval status',
        );
      }
    }

    for (const item of saleItems) {
      if (item.id) {
        const prev = existingSale.saleItems.find((si) => si.id === item.id);
        if (prev && item.status !== undefined) {
          if (
            isApprovedLabel(item.status) !== isApprovedLabel(prev.status) &&
            !isStoreRequestLineApprovalToStockIssue(prev.status, item.status)
          ) {
            await assertCanManageApprovals(
              this.permissionsService,
              user,
              'Store request (sale) line approval status',
            );
          }
        }
      } else if (isApprovedLabel(item.status)) {
        await assertCanManageApprovals(
          this.permissionsService,
          user,
          'New store request line with Approved status',
        );
      }
    }

    // Extract existing item IDs for comparison
    const existingItemIds = existingSale.saleItems.map(item => item.id);
    const newItemIds = updateSaleDto.saleItems.map(item => item.id);

    // Determine which items need to be deleted (those not in the new items list)
    const itemsToDelete = existingItemIds.filter(id => !newItemIds.includes(id));

    for (const item of saleItems) {
      if (!item.id && item.status === 'Stocked-out') {
        await assertCanPerformStoreStockIssue(this.permissionsService, user);
      }
      if (item.id && item.status !== undefined) {
        const prev = existingSale.saleItems.find((si) => si.id === item.id);
        if (prev && isSaleItemStockIssueTransition(prev.status, item.status)) {
          await assertCanPerformStoreStockIssue(this.permissionsService, user);
        }
      }
    }
    for (const delId of itemsToDelete) {
      const prev = existingSale.saleItems.find((si) => si.id === delId);
      if (prev?.status === 'Stocked-out') {
        await assertCanPerformStoreStockIssue(this.permissionsService, user);
      }
    }

    try {
      const mgr = this.itemRepository.manager;
      for (const item of saleItems) {
        const itemBaseId = item.itemBaseId ?? null;
        await assertItemVariantLineFields(mgr, item.itemId, itemBaseId);
        if (item.status === 'Requested') {
          await assertSaleRequestedAvailability(
            mgr,
            item.itemId,
            itemBaseId,
            parseFloat(item.unit.toString()),
          );
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
              itemBaseId: item.itemBaseId ?? null,
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
              id: randomUUID(),
              saleId: id,
              itemId: item.itemId,
              itemBaseId: item.itemBaseId ?? null,
              uomId: item.uomId,
              quantity: item.quantity,
              description: item.description,
              status: item.status,
              baseUomId: item.baseUomId,
              unit: parseFloat(item.unit.toString()),
              orderItemId: (item as any).orderItemId ?? null,
            })
            .execute();
        }
      }

      const changes: string[] = [];
      if (
        saleData.status !== undefined &&
        saleData.status !== existingSale.status
      ) {
        changes.push(
          `Header status: ${existingSale.status} → ${saleData.status}`,
        );
      }
      for (const item of saleItems) {
        if (!item.id) {
          changes.push(`New line (item ${item.itemId}, status ${item.status})`);
          continue;
        }
        const prev = existingSale.saleItems.find((si) => si.id === item.id);
        if (!prev) continue;
        if (item.status !== undefined && item.status !== prev.status) {
          changes.push(`Line ${item.id} status: ${prev.status} → ${item.status}`);
        }
      }
      if (itemsToDelete.length > 0) {
        changes.push(`${itemsToDelete.length} line(s) removed`);
      }
      if (changes.length > 0) {
        await this.notificationsService.notifyAllActiveUsers({
          type: 'STORE_REQUEST',
          title: `Store request ${existingSale.series} updated`,
          message: changes.join('\n'),
          data: {
            saleId: id,
            series: existingSale.series,
            changes,
          },
        });
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
