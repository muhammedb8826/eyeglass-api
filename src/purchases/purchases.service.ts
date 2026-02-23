import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { UpdatePurchaseDto } from './dto/update-purchase.dto';
import { Purchase } from '../entities/purchase.entity';
import { PurchaseItems } from '../entities/purchase-item.entity';
import { Vendor } from '../entities/vendor.entity';
import { User } from '../entities/user.entity';

@Injectable()
export class PurchasesService {
  constructor(
    @InjectRepository(Purchase)
    private purchaseRepository: Repository<Purchase>,
    @InjectRepository(PurchaseItems)
    private purchaseItemRepository: Repository<PurchaseItems>,
    @InjectRepository(Vendor)
    private vendorRepository: Repository<Vendor>,
    @InjectRepository(User)
    private userRepository: Repository<User>
  ) {}

  async create(createPurchaseDto: CreatePurchaseDto) {
    const { vendorId, purchaserId, ...purchaseData } = createPurchaseDto;
    
    try {
      // Create the purchase
      const purchase = this.purchaseRepository.create({
        series: purchaseData.series,
        status: purchaseData.status,
        orderDate: new Date(purchaseData.orderDate),
        paymentMethod: purchaseData.paymentMethod,
        amount: parseFloat(purchaseData.amount.toString()),
        reference: purchaseData.reference,
        totalAmount: parseFloat(purchaseData.totalAmount.toString()),
        totalQuantity: parseFloat(purchaseData.totalQuantity.toString()),
        note: purchaseData.note,
        vendorId,
        purchaserId,
      });

      const savedPurchase = await this.purchaseRepository.save(purchase);

      // Create purchase items
      const purchaseItems = createPurchaseDto.purchaseItems.map(item => 
        this.purchaseItemRepository.create({
          purchaseId: savedPurchase.id,
          itemId: item.itemId,
          uomId: item.uomId,
          baseUomId: item.baseUomId,
          unit: parseFloat(item.unit.toString()),
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: item.amount,
          description: item.description,
          status: item.status,
        })
      );

      await this.purchaseItemRepository.save(purchaseItems);

      return this.findOne(savedPurchase.id);

    } catch (error) {
      console.error("Error creating purchase:", error);

      if (error.code === 'ER_DUP_ENTRY') {
        throw new ConflictException('Unique constraint failed. Please check your data.');
      }

      throw new Error(`An unexpected error occurred: ${error.message}`);
    }
  }

  async findAll(skip: number, take: number, search?: string, startDate?: string, endDate?: string, item1?: string, item2?: string, item3?: string) {
    const queryBuilder = this.purchaseRepository
      .createQueryBuilder('purchase')
      .leftJoinAndSelect('purchase.vendor', 'vendor')
      .leftJoinAndSelect('purchase.purchaser', 'purchaser')
      .leftJoinAndSelect('purchase.purchaseItems', 'purchaseItems')
      .leftJoinAndSelect('purchaseItems.item', 'item')
      .orderBy('purchase.createdAt', 'DESC')
      .skip(Number(skip))
      .take(Number(take));

    // Handle the search filter
    if (search) {
      queryBuilder.andWhere(
        '(LOWER(purchase.id) LIKE LOWER(:search) OR LOWER(purchase.series) LIKE LOWER(:search) OR LOWER(vendor.fullName) LIKE LOWER(:search) OR LOWER(vendor.phone) LIKE LOWER(:search) OR LOWER(purchaseItems.description) LIKE LOWER(:search))',
        { search: `%${search}%` }
      );
    }

    // Handle the date range filter
    if (startDate && endDate) {
      queryBuilder.andWhere('purchase.orderDate BETWEEN :startDate AND :endDate', {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      });
    }

    // Collect the provided item names into an array
    const purchaseItemNames = [item1, item2, item3].filter(Boolean);

    // Handle order item names filter
    if (purchaseItemNames.length > 0) {
      const itemConditions = purchaseItemNames.map((name, index) => 
        `LOWER(item.name) LIKE LOWER(:item${index})`
      ).join(' OR ');
      
      queryBuilder.andWhere(`(${itemConditions})`);
      
      purchaseItemNames.forEach((name, index) => {
        queryBuilder.setParameter(`item${index}`, `%${name}%`);
      });
    }

    const [purchases, total] = await queryBuilder.getManyAndCount();

    // Calculate grand total sum
    const grandTotalSum = purchases.reduce((sum, purchase) => sum + purchase.amount, 0);

    return {
      purchases,
      total,
      grandTotalSum,
    };
  }

  async findAllPurchases() {
    return this.purchaseRepository.find({
      relations: {
        vendor: true,
        purchaser: true,
        purchaseItems: true,
      },
    });
  }

  async findOne(id: string) {
    const purchase = await this.purchaseRepository.findOne({
      where: { id },
      relations: {
        purchaseItems: true,
        vendor: true,
        purchaser: true,
      },
    });

    if (!purchase) {
      throw new NotFoundException(`Purchase with ID ${id} not found`);
    }

    return purchase;
  }

  async update(id: string, updatePurchaseDto: UpdatePurchaseDto) {
    const { purchaseItems, ...purchaseData } = updatePurchaseDto;

    // Fetch the existing purchase and its items
    const existingPurchase = await this.purchaseRepository.findOne({
      where: { id },
      relations: { purchaseItems: true },
    });

    if (!existingPurchase) {
      throw new NotFoundException(`Purchase with ID ${id} not found`);
    }

    // Extract existing item IDs for comparison
    const existingItemIds = existingPurchase.purchaseItems.map(item => item.id);
    const newItemIds = purchaseItems.map(item => item.id).filter(Boolean);

    // Determine which items need to be deleted (those not in the new items list)
    const itemsToDelete = existingItemIds.filter(id => !newItemIds.includes(id));

    try {
      // Delete items not in the new list
      if (itemsToDelete.length > 0) {
        await this.purchaseItemRepository
          .createQueryBuilder()
          .delete()
          .from(PurchaseItems)
          .where('id IN (:...ids)', { ids: itemsToDelete })
          .execute();
      }

      // Update the purchase (without purchaseItems)
      await this.purchaseRepository.update(id, purchaseData);

      // Update or create purchase items
      for (const item of purchaseItems) {
        if (item.id) {
          // Update existing item
          await this.purchaseItemRepository.update(item.id, {
            quantity: item.quantity,
            uomId: item.uomId,
            baseUomId: item.baseUomId,
            unit: parseFloat(item.unit.toString()),
            unitPrice: parseFloat(item.unitPrice.toString()),
            amount: item.amount,
            description: item.description,
            status: item.status,
          });
        } else {
          // Create new item
          const newItem = this.purchaseItemRepository.create({
            purchaseId: id,
            itemId: item.itemId,
            uomId: item.uomId,
            baseUomId: item.baseUomId,
            unit: parseFloat(item.unit.toString()),
            quantity: item.quantity,
            unitPrice: parseFloat(item.unitPrice.toString()),
            amount: item.amount,
            description: item.description,
            status: item.status,
          });
          await this.purchaseItemRepository.save(newItem);
        }
      }

      return this.findOne(id);
    } catch (error) {
      console.error('Error updating purchase:', error);
      if (error.code === 'ER_DUP_ENTRY') {
        throw new ConflictException('Unique constraint failed. Please check your data.');
      }
      throw new Error('An unexpected error occurred.');
    }
  }

  async remove(id: string) {
    // Fetch the purchase along with associated items
    const purchase = await this.purchaseRepository.findOne({
      where: { id },
      relations: { purchaseItems: true },
    });

    if (!purchase) {
      throw new NotFoundException(`Purchase with ID ${id} not found`);
    }

    if (purchase.purchaseItems.length > 0) {
      // Notify user that the purchase cannot be deleted because it has associated items
      throw new BadRequestException(`Cannot delete purchase with ID ${id} because it has associated items.`);
    }

    return await this.purchaseRepository.remove(purchase);
  }
}
