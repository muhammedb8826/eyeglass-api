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
  isApprovedLabel,
} from 'src/approvals/approval-authority.util';

@Injectable()
export class SalesService {
  constructor(
    @InjectRepository(Sale)
    private readonly saleRepository: Repository<Sale>,
    @InjectRepository(Item)
    private readonly itemRepository: Repository<Item>,
    private readonly permissionsService: PermissionsService,
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
            isApprovedLabel(item.status) !== isApprovedLabel(prev.status)
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
