import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { CreateOrderItemDto } from './dto/create-order-item.dto';
import { UpdateOrderItemDto } from './dto/update-order-item.dto';
import { OrderItems } from 'src/entities/order-item.entity';
import { Order } from 'src/entities/order.entity';
import { PaymentTerm } from 'src/entities/payment-term.entity';
import { OrdersService } from 'src/orders/orders.service';
import { SalesService } from 'src/sales/sales.service';
import { CreateSaleDto } from 'src/sales/dto/create-sale.dto';
import { SaleItems } from 'src/entities/sale-item.entity';
import { assertWorkflowOnlyOrderItemPayload } from './order-item-workflow.guard';

@Injectable()
export class OrderItemsService {
  constructor(
    @InjectRepository(OrderItems)
    private readonly orderItemsRepository: Repository<OrderItems>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(PaymentTerm)
    private readonly paymentTermRepository: Repository<PaymentTerm>,
    private readonly dataSource: DataSource,
    private readonly ordersService: OrdersService,
    private readonly salesService: SalesService,
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
        'item.bomLines',
        'item.bomLines.componentItem',
        'item.bomLines.uom',
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
      .leftJoinAndSelect('item.bomLines', 'bom')
      .leftJoinAndSelect('bom.componentItem', 'bomComponentItem')
      .leftJoinAndSelect('bom.uom', 'bomUom')
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
      relations: [
        'order',
        'uom',
        'pricing',
        'item',
        'item.bomLines',
        'item.bomLines.componentItem',
        'item.bomLines.uom',
        'itemBase',
        'service',
        'nonStockService',
        'orderItemNotes',
        'orderItemNotes.user',
      ],
    });
  }

  async update(id: string, updateOrderItemDto: UpdateOrderItemDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const currentOrderItem = await this.orderItemsRepository.findOne({
        where: { id },
        relations: ['item', 'item.bomLines'],
      });

      if (!currentOrderItem) {
        throw new NotFoundException('Order item not found');
      }

      // Industry standard: delivered lines are posted and immutable
      if (currentOrderItem.status === 'Delivered') {
        throw new ConflictException(
          'Delivered order items cannot be modified. Create a remake/replacement or a return/adjustment instead.',
        );
      }

      const order = await this.orderRepository.findOne({
        where: { id: currentOrderItem.orderId },
        select: ['id', 'status'],
      });

      const lineInProduction = ['InProgress', 'Ready'].includes(currentOrderItem.status);
      const lineApproved = currentOrderItem.approvalStatus === 'Approved';
      const orderInProduction =
        !!order && ['InProgress', 'Ready'].includes(order.status);

      if (lineInProduction || lineApproved || orderInProduction) {
        assertWorkflowOnlyOrderItemPayload(
          updateOrderItemDto as Record<string, unknown>,
          currentOrderItem,
        );
      }

      /** QC rejects lens (broken, etc.): rewind line for remake — new store request → production → QC again. */
      const qcFailureRemake =
        updateOrderItemDto.qualityControlStatus === 'Failed' &&
        currentOrderItem.qualityControlStatus !== 'Failed';

      let nextStatus = updateOrderItemDto.status ?? currentOrderItem.status;
      let nextApprovalStatus =
        updateOrderItemDto.approvalStatus ?? currentOrderItem.approvalStatus;
      let nextStoreRequestStatus =
        updateOrderItemDto.storeRequestStatus ?? currentOrderItem.storeRequestStatus;
      let newQualityControlStatus =
        updateOrderItemDto.qualityControlStatus ?? currentOrderItem.qualityControlStatus;

      if (qcFailureRemake) {
        nextStatus = 'Pending';
        nextApprovalStatus = 'Approved';
        newQualityControlStatus = 'Pending';
        // New material needed for remake: either open a new store request in this call (operatorId + Requested)
        // or leave None and the lab PATCHes Requested again (each path creates a separate Sale).
        nextStoreRequestStatus = updateOrderItemDto.operatorId?.trim()
          ? 'Requested'
          : 'None';
      }

      const orderIdForPayment = currentOrderItem.orderId;
      const orderPayment = await this.paymentTermRepository.findOne({
        where: { orderId: orderIdForPayment },
      });

      const transitioningToApproved =
        !qcFailureRemake &&
        nextApprovalStatus === 'Approved' &&
        currentOrderItem.approvalStatus !== 'Approved';

      const forcePaymentIncompleteForApproval =
        !!orderPayment?.forcePayment &&
        (Number(orderPayment.totalAmount) <= 0 || Number(orderPayment.remainingAmount) > 0);

      if (
        transitioningToApproved &&
        forcePaymentIncompleteForApproval
      ) {
        throw new ConflictException(
          `Cannot approve this line: force payment is enabled and payment is not complete (total ${orderPayment?.totalAmount ?? 0}, remaining ${orderPayment?.remainingAmount ?? 0}).`,
        );
      }

      if (
        nextStatus === 'InProgress' &&
        currentOrderItem.status !== 'InProgress' &&
        nextApprovalStatus !== 'Approved'
      ) {
        throw new ConflictException(
          'Cannot start production: order item is not approved. Set approvalStatus to "Approved" first.',
        );
      }

      // Enforce store issue before starting production
      if (
        nextStatus === 'InProgress' &&
        currentOrderItem.status !== 'InProgress' &&
        nextStoreRequestStatus !== 'Issued'
      ) {
        // Fallback sync: if the store already stocked-out all linked sale items,
        // auto-mark this order item as Issued and proceed.
        const linkedSaleItems = await queryRunner.manager.find(SaleItems, {
          where: { orderItemId: id as any },
        });
        const allStockedOut =
          linkedSaleItems.length > 0 &&
          linkedSaleItems.every(si => si.status === 'Stocked-out');
        if (allStockedOut) {
          await queryRunner.manager.update(OrderItems, { id }, { storeRequestStatus: 'Issued' });
          // update local computed value so later update uses Issued
          (updateOrderItemDto as any).storeRequestStatus = 'Issued';
        } else {
        throw new ConflictException(
          'Store must issue the required items before production can start. Ensure storeRequestStatus is "Issued".',
        );
        }
      }

      // Check payment verification based on forcePayment and line status changes
      if (orderPayment) {
        console.log('Payment verification:', {
          orderId: orderIdForPayment,
          newStatus: updateOrderItemDto.status,
          forcePayment: orderPayment.forcePayment,
          remainingAmount: orderPayment.remainingAmount,
          totalAmount: orderPayment.totalAmount,
        });

        // Delivered: full payment required when forcePayment is on
        if (
          nextStatus === 'Delivered' &&
          orderPayment.forcePayment &&
          (Number(orderPayment.totalAmount) <= 0 || Number(orderPayment.remainingAmount) > 0)
        ) {
          throw new ConflictException(
            `Payment is not completed. Cannot deliver order (total ${orderPayment.totalAmount}, remaining ${orderPayment.remainingAmount}).`,
          );
        }

        // Other workflow status changes: block if forcePayment and no payment at all (skip when only patching non-status fields)
        const newWorkflowStatus = updateOrderItemDto.status;
        if (
          !qcFailureRemake &&
          newWorkflowStatus !== undefined &&
          orderPayment.forcePayment &&
          Number(orderPayment.remainingAmount) === Number(orderPayment.totalAmount) &&
          newWorkflowStatus !== 'Delivered'
        ) {
          throw new ConflictException(
            `Payment is not completed. Cannot change status to "${newWorkflowStatus}" because force payment is enabled and no payment has been made.`,
          );
        }
      }

      // Prevent delivering an item unless QC has passed
      if (nextStatus === 'Delivered' && newQualityControlStatus !== 'Passed') {
        throw new ConflictException(
          'Cannot deliver item: quality control must be "Passed" before delivery.',
        );
      }

      // Preserve existing quantities when PATCH does not include quantity fields.
      const hasPerEye =
        updateOrderItemDto.quantityRight !== undefined || updateOrderItemDto.quantityLeft !== undefined;
      const hasLegacyQuantity = updateOrderItemDto.quantity !== undefined;
      const quantityRight = hasPerEye
        ? parseFloat((updateOrderItemDto.quantityRight ?? currentOrderItem.quantityRight ?? 0).toString())
        : hasLegacyQuantity
          ? parseFloat((updateOrderItemDto.quantity ?? 0).toString())
          : parseFloat((currentOrderItem.quantityRight ?? currentOrderItem.quantity ?? 0).toString());
      const quantityLeft = hasPerEye
        ? parseFloat((updateOrderItemDto.quantityLeft ?? currentOrderItem.quantityLeft ?? 0).toString())
        : hasLegacyQuantity
          ? 0
          : parseFloat((currentOrderItem.quantityLeft ?? 0).toString());
      const quantity = quantityRight + quantityLeft;

      const prevStoreRequestStatus = currentOrderItem.storeRequestStatus;
      const qcFailureOpensNewStoreRequest =
        qcFailureRemake &&
        nextStoreRequestStatus === 'Requested' &&
        !!updateOrderItemDto.operatorId?.trim();

      // New Sale + SaleItems: (1) QC fail remake with operatorId, or (2) None → Requested (first or repeat after None)
      if (qcFailureOpensNewStoreRequest) {
        await this.createStoreRequestForOrderItem(currentOrderItem, updateOrderItemDto, quantity);
      } else if (
        prevStoreRequestStatus === 'None' &&
        nextStoreRequestStatus === 'Requested'
      ) {
        if (!updateOrderItemDto.operatorId?.trim()) {
          throw new ConflictException(
            'operatorId is required to create a store request. Please include operatorId in the update payload.',
          );
        }
        await this.createStoreRequestForOrderItem(currentOrderItem, updateOrderItemDto, quantity);
      }

      const effectiveOrderId = updateOrderItemDto.orderId ?? currentOrderItem.orderId;

      // Update the order item
      await queryRunner.manager.update(OrderItems, id, {
        orderId: effectiveOrderId,
        itemId: updateOrderItemDto.itemId,
        itemBaseId: updateOrderItemDto.itemBaseId ?? undefined,
        quantity,
        quantityRight,
        quantityLeft,
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
        approvalStatus: nextApprovalStatus,
        qualityControlStatus: newQualityControlStatus,
        storeRequestStatus: nextStoreRequestStatus,
        uomId: updateOrderItemDto.uomId,
        unitPrice: parseFloat((updateOrderItemDto.unitPrice || 0).toString()),
        description: updateOrderItemDto.description,
        isDiscounted: updateOrderItemDto.isDiscounted,
        status: nextStatus,
        pricingId: updateOrderItemDto.pricingId,
        unit: parseFloat((updateOrderItemDto.unit || 0).toString()),
        baseUomId: updateOrderItemDto.baseUomId,
      });

      // Update order status based on all order items
      await this.updateOrderStatus(effectiveOrderId, queryRunner);

      // Re-validate lab tools for the whole order (per-eye: only eyes with quantityRight/quantityLeft > 0)
      const orderItemsForCheck = await queryRunner.manager.find(OrderItems, {
        where: { orderId: effectiveOrderId },
      });
      await this.ordersService.ensureLabToolsAvailableForOrderItems(orderItemsForCheck);

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

  private async createStoreRequestForOrderItem(
    orderItem: OrderItems,
    dto: UpdateOrderItemDto,
    quantity: number,
  ) {
    // Load order for context (series, etc.)
    const order = await this.orderRepository.findOne({ where: { id: orderItem.orderId } });

    const baseSeries = order?.series ?? orderItem.orderId;
    const series = `SR-${baseSeries}-${Date.now()}`;

    // Build sale items from BOM if present; otherwise from the parent item itself
    const saleItems = [];
    if (orderItem.item && Array.isArray((orderItem.item as any).bomLines) && (orderItem.item as any).bomLines.length > 0) {
      for (const bom of (orderItem.item as any).bomLines) {
        const unit = (bom.quantity || 0) * quantity;
        if (unit <= 0) continue;
        saleItems.push({
          id: '',
          itemId: bom.componentItemId,
          uomId: bom.uomId,
          baseUomId: bom.uomId,
          quantity: unit,
          unit,
          description: `Store request for order ${baseSeries} – component of ${orderItem.itemId}`,
          status: 'Requested',
          orderItemId: orderItem.id,
          saleItemNotes: [] as string[],
          saleId: '' as string,
        });
      }
    } else {
      // No BOM: request the ordered item itself
      if (quantity > 0) {
        saleItems.push({
          id: '',
          itemId: orderItem.itemId,
          ...(orderItem.itemBaseId ? { itemBaseId: orderItem.itemBaseId } : {}),
          uomId: orderItem.uomId,
          baseUomId: orderItem.baseUomId,
          quantity,
          unit: quantity,
          description: `Store request for order ${baseSeries} – item ${orderItem.itemId}`,
          status: 'Requested',
          orderItemId: orderItem.id,
          saleItemNotes: [] as string[],
          saleId: '' as string,
        });
      }
    }

    if (saleItems.length === 0) {
      return;
    }

    const saleDto: CreateSaleDto = {
      id: '' as any,
      series,
      operatorId: dto.operatorId as string,
      status: 'Requested',
      orderDate: new Date(),
      reference: order?.id,
      totalQuantity: quantity,
      note: `Automatic store request for order ${baseSeries}`,
      saleItems,
    };

    await this.salesService.create(saleDto);
  }

  private async updateOrderStatus(orderId: string, queryRunner?: any) {
    const orderItems = await (queryRunner ? queryRunner.manager.find(OrderItems, {
      where: { orderId },
    }) : this.orderItemsRepository.find({
      where: { orderId },
    }));

    // Check if all statuses are the same (eyeglass manufacturing standard)
    const allPending = orderItems.every(item => item.status === 'Pending');
    const allInProgress = orderItems.every(item => item.status === 'InProgress');
    const allReady = orderItems.every(item => item.status === 'Ready');
    const allDelivered = orderItems.every(item => item.status === 'Delivered');

    let newOrderStatus = 'Processing'; // Default when mixed statuses

    if (allPending) {
      newOrderStatus = 'Pending';
    } else if (allInProgress) {
      newOrderStatus = 'InProgress';
    } else if (allReady) {
      newOrderStatus = 'Ready';
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
