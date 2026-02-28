import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { CreateOrderItemDto } from './dto/create-order-item.dto';
import { UpdateOrderItemDto } from './dto/update-order-item.dto';
import { OrderItems } from 'src/entities/order-item.entity';
import { Order } from 'src/entities/order.entity';
import { OperatorStock } from 'src/entities/operator-stock.entity';
import { PaymentTerm } from 'src/entities/payment-term.entity';

@Injectable()
export class OrderItemsService {
  constructor(
    @InjectRepository(OrderItems)
    private readonly orderItemsRepository: Repository<OrderItems>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OperatorStock)
    private readonly operatorStockRepository: Repository<OperatorStock>,
    @InjectRepository(PaymentTerm)
    private readonly paymentTermRepository: Repository<PaymentTerm>,
    private readonly dataSource: DataSource,
  ) {}

  async create(createOrderItemDto: CreateOrderItemDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Create the order item
      const orderItemData = { ...createOrderItemDto } as any;
      delete orderItemData.orderItemNotes;
      const orderItem = this.orderItemsRepository.create(orderItemData);
      const createdOrderItem = await queryRunner.manager.save(OrderItems, orderItem);

      // Update order status based on all order items
      await this.updateOrderStatus(createOrderItemDto.orderId, queryRunner);

      await queryRunner.commitTransaction();
      return createdOrderItem;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error('Error creating order item:', error);

      if (error.code === 'ER_DUP_ENTRY') {
        throw new ConflictException('Unique constraint failed. Please check your data.');
      }

      throw new Error(`An unexpected error occurred: ${error.message}`);
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(orderId: string) {
    return await this.orderItemsRepository.find({
      where: { orderId },
      relations: [
        'order',
        'uom',
        'pricing',
        'item',
        'itemBase',
        'service',
        'orderItemNotes',
        'orderItemNotes.user'
      ]
    });
  }

  async findAllOrderItems(skip: number, take: number, search?: string, startDate?: string, endDate?: string, item?: string, status?: string) {
    const queryBuilder = this.orderItemsRepository
      .createQueryBuilder('orderItems')
      .leftJoinAndSelect('orderItems.order', 'order')
      .leftJoinAndSelect('order.customer', 'customer')
      .leftJoinAndSelect('orderItems.uom', 'uom')
      .leftJoinAndSelect('orderItems.pricing', 'pricing')
      .leftJoinAndSelect('orderItems.item', 'item')
      .leftJoinAndSelect('orderItems.itemBase', 'itemBase')
      .leftJoinAndSelect('orderItems.service', 'service')
      .leftJoinAndSelect('orderItems.orderItemNotes', 'orderItemNotes')
      .leftJoinAndSelect('orderItemNotes.user', 'user')
      .orderBy('orderItems.createdAt', 'DESC')
      .skip(Number(skip))
      .take(Number(take));

    // Search filter
    if (search) {
      queryBuilder.where(
        '(order.series LIKE :search OR customer.fullName LIKE :search OR customer.phone LIKE :search OR customer.email LIKE :search)',
        { search: `%${search}%` }
      );
    }

    // Date range filter
    if (startDate && endDate) {
      queryBuilder.andWhere('order.orderDate BETWEEN :startDate AND :endDate', {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      });
    }

    // Item filter
    if (item) {
      queryBuilder.andWhere('item.name LIKE :item', { item: `%${item}%` });
    }

    // Status filter
    if (status) {
      queryBuilder.andWhere('orderItems.status = :status', { status });
    }

    const [orderItems, total] = await queryBuilder.getManyAndCount();

    // Calculate total amount sum
    const totalAmountQuery = this.orderItemsRepository
      .createQueryBuilder('orderItems')
      .select('SUM(orderItems.totalAmount)', 'totalAmountSum');

    // Apply the same filters to the sum query
    if (search) {
      totalAmountQuery.leftJoin('orderItems.order', 'order')
        .leftJoin('order.customer', 'customer')
        .where('(order.series LIKE :search OR customer.fullName LIKE :search OR customer.phone LIKE :search OR customer.email LIKE :search)', 
          { search: `%${search}%` });
    }

    if (startDate && endDate) {
      totalAmountQuery.andWhere('order.orderDate BETWEEN :startDate AND :endDate', {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      });
    }

    if (item) {
      totalAmountQuery.leftJoin('orderItems.item', 'item')
        .andWhere('item.name LIKE :item', { item: `%${item}%` });
    }

    if (status) {
      totalAmountQuery.andWhere('orderItems.status = :status', { status });
    }

    const totalAmountResult = await totalAmountQuery.getRawOne();
    const totalAmountSum = totalAmountResult?.totalAmountSum || 0;

    return {
      orderItems,
      total,
      totalAmountSum,
    };
  }

  async findOne(id: string) {
    return this.orderItemsRepository.findOne({
      where: { id },
      relations: ['order', 'uom', 'pricing', 'item', 'itemBase', 'service', 'nonStockService', 'orderItemNotes', 'orderItemNotes.user'],
    });
  }

  async update(id: string, updateOrderItemDto: UpdateOrderItemDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get the current order item to check status changes
      const currentOrderItem = await this.orderItemsRepository.findOne({
        where: { id },
        relations: ['item'],
      });

      if (!currentOrderItem) {
        throw new NotFoundException('Order item not found');
      }

      // Handle stock reduction for Printed or Void status (only when status changes to these states)
      // Only reduce stock for stock services (not non-stock services like PRINT-ONLY, CUT-ONLY)
      if ((updateOrderItemDto.status === 'Printed' || updateOrderItemDto.status === 'Void') && 
          currentOrderItem.status !== 'Printed' && currentOrderItem.status !== 'Void' &&
          !currentOrderItem.isNonStockService) {
        
        const operatorStock = await this.operatorStockRepository.findOne({
          where: { itemId: currentOrderItem.itemId },
        });

        if (!operatorStock) {
          throw new ConflictException(`Please make a request for item ${currentOrderItem.item.name} before trying to print`);
        }

        // Use unit as the quantity to reduce (unit represents the total measurement amount)
        const quantityToReduce = currentOrderItem.unit;
        
        // Check if the stock quantity is sufficient
        if (operatorStock.quantity < quantityToReduce) {
          throw new ConflictException(`Insufficient stock for item: ${currentOrderItem.item.name}. Available: ${operatorStock.quantity}, Required: ${quantityToReduce}`);
        }

        // Reduce stock
        await queryRunner.manager.update(OperatorStock, operatorStock.id, {
          quantity: operatorStock.quantity - quantityToReduce,
        });
      }

      // Handle stock restoration when status changes from Printed/Void to other states
      // Only restore stock for stock services (not non-stock services like PRINT-ONLY, CUT-ONLY)
      if ((currentOrderItem.status === 'Printed' || currentOrderItem.status === 'Void') && 
          updateOrderItemDto.status !== 'Printed' && updateOrderItemDto.status !== 'Void' &&
          !currentOrderItem.isNonStockService) {
        
        const operatorStock = await this.operatorStockRepository.findOne({
          where: { itemId: currentOrderItem.itemId },
        });

        if (operatorStock) {
          // Use unit as the quantity to restore (unit represents the total measurement amount)
          const quantityToRestore = currentOrderItem.unit;
          
          // Restore stock
          await queryRunner.manager.update(OperatorStock, operatorStock.id, {
            quantity: operatorStock.quantity + quantityToRestore,
          });
        }
      }

      // Check payment verification based on forcePayment setting and status
      const orderPayment = await this.paymentTermRepository.findOne({
        where: { orderId: updateOrderItemDto.orderId },
        relations: ['order'],
      });

      if (orderPayment) {
        console.log('Payment verification:', {
          orderId: updateOrderItemDto.orderId,
          newStatus: updateOrderItemDto.status,
          forcePayment: orderPayment.forcePayment,
          remainingAmount: orderPayment.remainingAmount,
          totalAmount: orderPayment.totalAmount
        });

        // Check payment when status changes to "Delivered" - only if forcePayment is true
        if (updateOrderItemDto.status === 'Delivered' && orderPayment.forcePayment && orderPayment.remainingAmount > 0) {
          throw new ConflictException(
            `Payment is not completed. Cannot deliver order with outstanding payment of ${orderPayment.remainingAmount}.`
          );
        }
        
        // For other status changes, only block if forcePayment is true and payment is not paid at all
        if (
          orderPayment.forcePayment &&
          orderPayment.remainingAmount === orderPayment.totalAmount && // Not paid at all
          updateOrderItemDto.status !== 'Delivered'
        ) {
          throw new ConflictException(
            `Payment is not completed. Cannot change status to "${updateOrderItemDto.status}" because force payment is enabled and no payment has been made.`
          );
        }
      }

      // Update the order item
      await queryRunner.manager.update(OrderItems, id, {
        orderId: updateOrderItemDto.orderId,
        itemId: updateOrderItemDto.itemId,
        itemBaseId: updateOrderItemDto.itemBaseId ?? undefined,
        quantity: updateOrderItemDto.quantity,
        serviceId: updateOrderItemDto.serviceId,
        discount: parseFloat((updateOrderItemDto.discount || 0).toString()),
        level: updateOrderItemDto.level,
        // Lens / prescription fields
        sphereRight: updateOrderItemDto.sphereRight,
        sphereLeft: updateOrderItemDto.sphereLeft,
        cylinderRight: updateOrderItemDto.cylinderRight,
        cylinderLeft: updateOrderItemDto.cylinderLeft,
        axisRight: updateOrderItemDto.axisRight,
        axisLeft: updateOrderItemDto.axisLeft,
        prismRight: updateOrderItemDto.prismRight,
        prismLeft: updateOrderItemDto.prismLeft,
        addRight: updateOrderItemDto.addRight,
        addLeft: updateOrderItemDto.addLeft,
        pd: updateOrderItemDto.pd,
        pdMonocularRight: updateOrderItemDto.pdMonocularRight,
        pdMonocularLeft: updateOrderItemDto.pdMonocularLeft,
        lensType: updateOrderItemDto.lensType,
        lensMaterial: updateOrderItemDto.lensMaterial,
        lensCoating: updateOrderItemDto.lensCoating,
        lensIndex: updateOrderItemDto.lensIndex,
        totalAmount: parseFloat((updateOrderItemDto.totalAmount || 0).toString()),
        adminApproval: updateOrderItemDto.adminApproval,
        uomId: updateOrderItemDto.uomId,
        unitPrice: parseFloat((updateOrderItemDto.unitPrice || 0).toString()),
        description: updateOrderItemDto.description,
        isDiscounted: updateOrderItemDto.isDiscounted,
        status: updateOrderItemDto.status,
        pricingId: updateOrderItemDto.pricingId,
        unit: parseFloat((updateOrderItemDto.unit || 0).toString()),
        baseUomId: updateOrderItemDto.baseUomId,
      });

      // Update order status based on all order items
      await this.updateOrderStatus(updateOrderItemDto.orderId, queryRunner);

      await queryRunner.commitTransaction();

      return await this.orderItemsRepository.findOne({
        where: { id },
        relations: ['order', 'item', 'itemBase', 'service', 'pricing', 'uom'],
      });
    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error('Error updating order item:', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async remove(id: string) {
    const orderItem = await this.orderItemsRepository.findOne({
      where: { id },
      relations: ['order'],
    });

    if (!orderItem) {
      throw new NotFoundException('Order item not found');
    }

    const orderId = orderItem.orderId;
    await this.orderItemsRepository.remove(orderItem);

    // Update order status after removal
    await this.updateOrderStatus(orderId);

    return { message: `Order item with ID ${id} removed successfully` };
  }

  private async updateOrderStatus(orderId: string, queryRunner?: any) {
    const orderItems = await (queryRunner ? queryRunner.manager.find(OrderItems, {
      where: { orderId },
    }) : this.orderItemsRepository.find({
      where: { orderId },
    }));

    // Check if all statuses are the same
    const allReceived = orderItems.every(item => item.status === 'Received');
    const allPrinted = orderItems.every(item => item.status === 'Printed');
    const allCompleted = orderItems.every(item => item.status === 'Completed');
    const allDelivered = orderItems.every(item => item.status === 'Delivered');

    let newOrderStatus = 'Processing'; // Default status

    if (allReceived) {
      newOrderStatus = 'Pending';
    } else if (allPrinted) {
      newOrderStatus = 'Printed';
    } else if (allCompleted) {
      newOrderStatus = 'Completed';
    } else if (allDelivered) {
      newOrderStatus = 'Delivered';
    }

    // Update the order status
    await (queryRunner ? queryRunner.manager.update(Order, orderId, {
      status: newOrderStatus,
    }) : this.orderRepository.update(orderId, {
      status: newOrderStatus,
    }));
  }
}
