import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateOperatorStockDto } from './dto/create-operator-stock.dto';
import { UpdateOperatorStockDto } from './dto/update-operator-stock.dto';
import { OperatorStock } from 'src/entities/operator-stock.entity';


@Injectable()
export class OperatorStockService {
  constructor(
    @InjectRepository(OperatorStock)
    private readonly operatorStockRepository: Repository<OperatorStock>,
  ) {}

  async create(createOperatorStockDto: CreateOperatorStockDto) {
    // Create a new operator stock record
    const newOperatorStock = this.operatorStockRepository.create(createOperatorStockDto);
    const savedOperatorStock = await this.operatorStockRepository.save(newOperatorStock);
    
    // Return the created entity with relations
    return await this.operatorStockRepository.findOne({
      where: { id: savedOperatorStock.id },
      relations: ['item', 'uoms'],
    });
  }

  async findAll(skip: number, take: number, search?: string) {
    const queryBuilder = this.operatorStockRepository
      .createQueryBuilder('operatorStock')
      .leftJoinAndSelect('operatorStock.item', 'item')
      .leftJoinAndSelect('operatorStock.uoms', 'uoms')
      .orderBy('operatorStock.createdAt', 'DESC')
      .skip(Number(skip))
      .take(Number(take));

    if (search) {
      queryBuilder.where('item.name LIKE :search', { search: `%${search}%` });
    }

    const [operatorStocks, total] = await queryBuilder.getManyAndCount();

    return { operatorStocks, total };
  }

  async findOne(id: string) {
    // Retrieve a single operator stock record by ID
    const operatorStock = await this.operatorStockRepository.findOne({
      where: { id },
      relations: ['item', 'uoms'],
    });

    if (!operatorStock) {
      throw new NotFoundException(`Operator Stock with ID ${id} not found`);
    }

    return operatorStock;
  }

  async update(id: string, updateOperatorStockDto: UpdateOperatorStockDto) {
    // Check if the operator stock record exists
    const operatorStock = await this.operatorStockRepository.findOne({
      where: { id },
    });

    if (!operatorStock) {
      throw new NotFoundException(`Operator Stock with ID ${id} not found`);
    }

    // Update the operator stock record
    await this.operatorStockRepository.update(id, updateOperatorStockDto);
    
    // Return the updated entity with relations
    return await this.operatorStockRepository.findOne({
      where: { id },
      relations: ['item', 'uoms'],
    });
  }

  async remove(id: string) {
    // Check if the operator stock record exists
    const operatorStock = await this.operatorStockRepository.findOne({
      where: { id },
    });

    if (!operatorStock) {
      throw new NotFoundException(`Operator Stock with ID ${id} not found`);
    }

    // Delete the operator stock record
    await this.operatorStockRepository.remove(operatorStock);

    return { message: `Operator Stock with ID ${id} removed successfully` };
  }

  async reduceStockForOrder(orderItems: any[]) {
    const stockUpdates = [];
    
    for (const orderItem of orderItems) {
      // Find the operator stock for this item
      const operatorStock = await this.operatorStockRepository.findOne({
        where: { itemId: orderItem.itemId },
        relations: ['item'],
      });

      if (!operatorStock) {
        throw new NotFoundException(`No operator stock found for item: ${orderItem.itemId}`);
      }

      // Use unit as the quantity to reduce (unit represents the total measurement amount)
      const quantityToReduce = parseFloat(orderItem.unit?.toString() || '0');
      
      console.log(`Stock reduction calculation:`, {
        itemId: orderItem.itemId,
        itemName: operatorStock.item?.name,
        availableStock: operatorStock.quantity,
        requestedUnit: quantityToReduce,
        quantityToReduce: quantityToReduce
      });
      
      // Check if there's enough stock
      if (operatorStock.quantity < quantityToReduce) {
        throw new NotFoundException(
          `Insufficient stock for item: ${operatorStock.item?.name || orderItem.itemId}. Available: ${operatorStock.quantity}, Required: ${quantityToReduce}`
        );
      }

      // Reduce the stock
      const newQuantity = operatorStock.quantity - quantityToReduce;
      
      stockUpdates.push({
        id: operatorStock.id,
        quantity: newQuantity,
        description: `Stock reduced by ${quantityToReduce} due to order placement`,
        status: newQuantity === 0 ? 'Out of Stock' : 'Available'
      });
    }

    // Update all stock records
    for (const update of stockUpdates) {
      await this.operatorStockRepository.update(update.id, {
        quantity: update.quantity,
        description: update.description,
        status: update.status
      });
    }

    return stockUpdates;
  }

  async findStockByItemId(itemId: string) {
    return await this.operatorStockRepository.findOne({
      where: { itemId },
      relations: ['item', 'uoms'],
    });
  }

  async restoreStockForOrder(orderItems: any[]) {
    const stockUpdates = [];
    
    for (const orderItem of orderItems) {
      // Find the operator stock for this item
      const operatorStock = await this.operatorStockRepository.findOne({
        where: { itemId: orderItem.itemId },
        relations: ['item'],
      });

      if (!operatorStock) {
        throw new NotFoundException(`No operator stock found for item: ${orderItem.itemId}`);
      }

      // Use unit as the quantity to restore (unit represents the total measurement amount)
      const quantityToRestore = parseFloat(orderItem.unit?.toString() || '0');
      
      // Restore the stock
      const newQuantity = operatorStock.quantity + quantityToRestore;
      
      stockUpdates.push({
        id: operatorStock.id,
        quantity: newQuantity,
        description: `Stock restored by ${quantityToRestore} due to order cancellation/update`,
        status: 'Available'
      });
    }

    // Update all stock records
    for (const update of stockUpdates) {
      await this.operatorStockRepository.update(update.id, {
        quantity: update.quantity,
        description: update.description,
        status: update.status
      });
    }

    return stockUpdates;
  }
}
