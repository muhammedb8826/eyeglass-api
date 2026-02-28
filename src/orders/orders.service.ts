import { ConflictException, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In, IsNull } from 'typeorm';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { Order } from '../entities/order.entity';
import { Pricing } from 'src/entities/pricing.entity';
import { OrderItems } from 'src/entities/order-item.entity';
import { PaymentTerm } from 'src/entities/payment-term.entity';
import { PaymentTransaction } from 'src/entities/payment-transaction.entity';
import { Commission } from 'src/entities/commission.entity';
import { CommissionTransaction } from 'src/entities/commission-transaction.entity';
import { FixedCost } from 'src/entities/fixed-cost.entity';
import { Item } from 'src/entities/item.entity';
import { UOM } from 'src/entities/uom.entity';
import { UnitCategory } from 'src/entities/unit-category.entity';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Pricing)
    private readonly pricingRepository: Repository<Pricing>,
    @InjectRepository(OrderItems)
    private readonly orderItemsRepository: Repository<OrderItems>,
    @InjectRepository(PaymentTerm)
    private readonly paymentTermRepository: Repository<PaymentTerm>,
    @InjectRepository(PaymentTransaction)
    private readonly paymentTransactionRepository: Repository<PaymentTransaction>,
    @InjectRepository(Commission)
    private readonly commissionRepository: Repository<Commission>,
    @InjectRepository(CommissionTransaction)
    private readonly commissionTransactionRepository: Repository<CommissionTransaction>,
    @InjectRepository(FixedCost)
    private readonly fixedCostRepository: Repository<FixedCost>,
    @InjectRepository(Item)
    private readonly itemRepository: Repository<Item>,
    @InjectRepository(UOM)
    private readonly uomRepository: Repository<UOM>,
    @InjectRepository(UnitCategory)
    private readonly unitCategoryRepository: Repository<UnitCategory>,
    private readonly dataSource: DataSource,
  ) {}

  async create(createOrderDto: CreateOrderDto) {
    // Validate required fields
    if (!createOrderDto.customerId) {
      throw new BadRequestException('Customer ID is required');
    }
    if (!createOrderDto.orderItems || createOrderDto.orderItems.length === 0) {
      throw new BadRequestException('At least one order item is required');
    }
    if (!createOrderDto.series) {
      throw new BadRequestException('Series is required');
    }

    // Validate order items
    for (const item of createOrderDto.orderItems) {
      if (!item.itemId) {
        throw new BadRequestException('Item ID is required for all order items');
      }
      // Service is optional for eyeglass: item-only lines use pricing by item (and itemBase)
      if (item.nonStockServiceId && !item.isNonStockService) {
        throw new BadRequestException('isNonStockService must be true when nonStockServiceId is provided');
      }
      if (item.serviceId && item.isNonStockService) {
        throw new BadRequestException('isNonStockService must be false when serviceId is provided');
      }
      // pricingId is optional: when omitted, backend resolves from itemId (+ optional itemBaseId) for item-only pricing
      if (!item.uomId) {
        throw new BadRequestException('UOM ID is required for all order items');
      }
      if (!item.baseUomId) {
        throw new BadRequestException('Base UOM ID is required for all order items');
      }
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Resolve pricing for each order item: use pricingId if provided, else resolve by item (+ itemBase)
      const resolvedOrderItems = await Promise.all(createOrderDto.orderItems.map(async (item) => {
        let pricingId = item.pricingId;
        if (!pricingId && item.itemId) {
          const pricing = await this.pricingRepository.findOne({
            where: {
              itemId: item.itemId,
              ...(item.itemBaseId ? { itemBaseId: item.itemBaseId } : { itemBaseId: IsNull() }),
              serviceId: IsNull(),
              nonStockServiceId: IsNull(),
            },
          });
          if (!pricing) {
            throw new BadRequestException(
              `No pricing found for item ${item.itemId}${item.itemBaseId ? ` and base ${item.itemBaseId}` : ''}. Add item-only pricing or send pricingId.`
            );
          }
          pricingId = pricing.id;
        }
        return { ...item, pricingId };
      }));

      for (const item of resolvedOrderItems) {
        const pricingExists = await this.pricingRepository.findOne({
          where: { id: item.pricingId },
        });
        if (!pricingExists) {
          throw new ConflictException(`Pricing with id ${item.pricingId} not found.`);
        }
      }

      // Create the main order
      const order = this.orderRepository.create({
        series: createOrderDto.series,
        customerId: createOrderDto.customerId,
        status: createOrderDto.status,
        orderDate: createOrderDto.orderDate ? new Date(createOrderDto.orderDate) : new Date(),
        deliveryDate: createOrderDto.deliveryDate ? new Date(createOrderDto.deliveryDate) : new Date(),
        orderSource: createOrderDto.orderSource,
        totalAmount: parseFloat((createOrderDto.totalAmount || 0).toString()),
        tax: parseFloat((createOrderDto.tax || 0).toString()),
        grandTotal: parseFloat((createOrderDto.grandTotal || 0).toString()),
        totalQuantity: parseFloat((createOrderDto.totalQuantity || 0).toString()),
        internalNote: createOrderDto.internalNote,
        fileNames: createOrderDto.fileNames || [],
        adminApproval: createOrderDto.adminApproval || false,
        salesPartnersId: createOrderDto.salesPartner?.id,
        prescriptionDate: createOrderDto.prescriptionDate ? new Date(createOrderDto.prescriptionDate) : null,
        optometristName: createOrderDto.optometristName,
        urgency: createOrderDto.urgency,
      });

      const savedOrder = await queryRunner.manager.save(Order, order);

      // Create order items with calculated totalCost and sales (use resolved pricing)
      const orderItems = await Promise.all(resolvedOrderItems.map(async (item) => {
        const quantity = parseFloat((item.quantity || 0).toString());

        // Determine which service ID to use for calculations (null for item-only eyeglass lines)
        const serviceIdForCalculation = item.isNonStockService ? item.nonStockServiceId : item.serviceId;

        let totalCostResult = { totalCost: 0, unit: 0, baseUomId: item.baseUomId || item.uomId };
        let salesResult = { sales: 0, unit: 0, baseUomId: item.baseUomId || item.uomId };

        try {
          totalCostResult = await this.calculateTotalCost(
            item.itemId,
            serviceIdForCalculation,
            item.uomId,
            quantity,
            item.isNonStockService,
            item.itemBaseId
          );
          salesResult = await this.calculateSales(
            item.itemId,
            serviceIdForCalculation,
            item.uomId,
            quantity,
            item.isNonStockService,
            item.itemBaseId
          );
        } catch (error) {
          console.warn(`Pricing calculation failed for item ${item.itemId}:`, error.message);
        }

        return this.orderItemsRepository.create({
          orderId: savedOrder.id,
          itemId: item.itemId,
          itemBaseId: item.itemBaseId || null,
          serviceId: item.isNonStockService ? null : item.serviceId,
          nonStockServiceId: item.isNonStockService ? item.nonStockServiceId : null,
          isNonStockService: item.isNonStockService || false,
          discount: parseFloat((item.discount || 0).toString()),
          level: parseFloat((item.level || 0).toString()),
          // Lens / prescription fields
          sphereRight: item.sphereRight,
          sphereLeft: item.sphereLeft,
          cylinderRight: item.cylinderRight,
          cylinderLeft: item.cylinderLeft,
          axisRight: item.axisRight,
          axisLeft: item.axisLeft,
          prismRight: item.prismRight,
          prismLeft: item.prismLeft,
          addRight: item.addRight,
          addLeft: item.addLeft,
          pd: item.pd,
          pdMonocularRight: item.pdMonocularRight,
          pdMonocularLeft: item.pdMonocularLeft,
          lensType: item.lensType,
          lensMaterial: item.lensMaterial,
          lensCoating: item.lensCoating,
          lensIndex: item.lensIndex,
          baseCurve: item.baseCurve,
          diameter: item.diameter,
          tintColor: item.tintColor,
          totalAmount: parseFloat((item.totalAmount || 0).toString()),
          adminApproval: item.adminApproval || false,
          uomId: item.uomId,
          quantity: quantity,
          unitPrice: parseFloat((item.unitPrice || 0).toString()),
          description: item.description || '',
          isDiscounted: item.isDiscounted || false,
          status: item.status,
          pricingId: item.pricingId,
          unit: totalCostResult.unit || parseFloat((item.unit || 0).toString()),
          baseUomId: totalCostResult.baseUomId || item.baseUomId || item.uomId,
          totalCost: totalCostResult.totalCost || 0,
          sales: salesResult.sales || 0,
        });
      }));

      await queryRunner.manager.save(OrderItems, orderItems);

      // Stock reduction is now handled when status changes to "Printed" in the order items service
      // Removed stock reduction from order creation

      // Handle payment term - support both array and object formats
      let paymentTermData = createOrderDto.paymentTerm;
      if (Array.isArray(paymentTermData)) {
        paymentTermData = paymentTermData[0]; // Take the first item if it's an array
      }

      if (paymentTermData) {
        const hasTransactions = paymentTermData.transactions && paymentTermData.transactions.length > 0;
        const remainingAmount = parseFloat((paymentTermData.remainingAmount || 0).toString());
        
        // Determine status based on transactions and remaining amount
        let paymentStatus = 'Not Paid';
        if (hasTransactions) {
          if (remainingAmount === 0) {
            paymentStatus = 'Fully Paid';
          } else if (remainingAmount > 0 && remainingAmount < createOrderDto.grandTotal) {
            paymentStatus = 'Partially Paid';
          }
        }

        const paymentTerm = this.paymentTermRepository.create({
          orderId: savedOrder.id,
          totalAmount: parseFloat((paymentTermData.totalAmount || 0).toString()),
          remainingAmount: remainingAmount,
          status: paymentStatus,
          forcePayment: paymentTermData.forcePayment || false,
        });

        const savedPaymentTerm = await queryRunner.manager.save(PaymentTerm, paymentTerm);

        // Create payment transactions if provided
        if (hasTransactions) {
          const paymentTransactions = paymentTermData.transactions.map(transaction => {
            const statusStr = typeof transaction.status === 'string' ? transaction.status.toLowerCase() : '';
            const normalizedStatus = statusStr === 'paid' ? 'Paid' : statusStr === 'pending' ? 'Pending' : (transaction.status || 'Pending');
            return this.paymentTransactionRepository.create({
              paymentTermId: savedPaymentTerm.id,
              date: transaction.date ? new Date(transaction.date) : new Date(),
              paymentMethod: transaction.paymentMethod,
              reference: transaction.reference || '',
              amount: parseFloat((transaction.amount || 0).toString()),
              status: normalizedStatus,
              description: transaction.description || '',
            });
          });

          await queryRunner.manager.save(PaymentTransaction, paymentTransactions);
        }
      }

      // Create commission if provided
      if (createOrderDto.commission) {
        const commission = this.commissionRepository.create({
          orderId: savedOrder.id,
          salesPartnerId: createOrderDto.commission.salesPartnerId,
          totalAmount: parseFloat((createOrderDto.commission.totalAmount || 0).toString()),
          paidAmount: parseFloat((createOrderDto.commission.paidAmount || 0).toString()),
        });

        const savedCommission = await queryRunner.manager.save(Commission, commission);

        // Create commission transactions if provided
        if (createOrderDto.commission.transactions?.length > 0) {
          const commissionTransactions = createOrderDto.commission.transactions.map(transaction =>
            this.commissionTransactionRepository.create({
              commissionId: savedCommission.id,
              date: transaction.date ? new Date(transaction.date) : new Date(),
              amount: parseFloat((transaction.amount || 0).toString()),
              percentage: parseFloat((transaction.percentage || 0).toString()),
              paymentMethod: transaction.paymentMethod,
              reference: transaction.reference,
              status: transaction.status,
              description: transaction.description,
            })
          );

          await queryRunner.manager.save(CommissionTransaction, commissionTransactions);
        }
      }

      await queryRunner.commitTransaction();

      // Return the complete order with all relations (item + machine = tool for eyeglass)
      return await this.orderRepository.findOne({
        where: { id: savedOrder.id },
        relations: [
          'customer',
          'orderItems',
          'orderItems.item',
          'orderItems.item.machine',
          'orderItems.itemBase',
          'orderItems.pricing',
          'paymentTerm',
          'paymentTerm.transactions',
          'commission',
          'commission.transactions',
          'salesPartner'
        ],
      });

    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error('Error creating order:', error);

      if (error.code === 'ER_DUP_ENTRY') {
        throw new ConflictException('Unique constraint failed. Please check your data.');
      }

      // Log more detailed error information
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        code: error.code,
        sqlMessage: error.sqlMessage
      });

      throw new Error(`An unexpected error occurred: ${error.message}`);
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(skip: number, take: number, search?: string, startDate?: string, endDate?: string, item1?: string, item2?: string, item3?: string) {
    const queryBuilder = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.customer', 'customer')
      .leftJoinAndSelect('order.orderItems', 'orderItems')
      .leftJoinAndSelect('orderItems.item', 'orderItemsItem')
      .leftJoinAndSelect('orderItems.pricing', 'orderItemsPricing')
      .leftJoinAndSelect('orderItems.service', 'orderItemsService')
      .leftJoinAndSelect('orderItems.nonStockService', 'orderItemsNonStockService')
      .leftJoinAndSelect('order.paymentTerm', 'paymentTerm')
      .leftJoinAndSelect('paymentTerm.transactions', 'paymentTransactions')
      .leftJoinAndSelect('order.commission', 'commission')
      .leftJoinAndSelect('commission.transactions', 'commissionTransactions')
      .leftJoinAndSelect('order.salesPartner', 'salesPartner')
      .orderBy('order.createdAt', 'DESC')
      .skip(Number(skip))
      .take(Number(take));

    // Handle search filter
    if (search) {
      queryBuilder.where(
        '(order.id LIKE :search OR order.series LIKE :search OR customer.fullName LIKE :search OR customer.phone LIKE :search OR orderItems.description LIKE :search OR paymentTransactions.reference LIKE :search OR commissionTransactions.reference LIKE :search OR salesPartner.fullName LIKE :search)',
        { search: `%${search}%` }
      );
    }

    // Handle date range filter
    if (startDate && endDate) {
      queryBuilder.andWhere('order.orderDate BETWEEN :startDate AND :endDate', {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      });
    }

    // Collect the provided item names into an array
    const orderItemNames = [item1, item2, item3].filter(Boolean);

    // Handle order item names filter
    if (orderItemNames.length > 0) {
      const itemConditions = orderItemNames.map((name, index) => 
        `orderItemsItem.name LIKE :item${index}`
      ).join(' OR ');
      
      queryBuilder.andWhere(`(${itemConditions})`);
      
      orderItemNames.forEach((name, index) => {
        queryBuilder.setParameter(`item${index}`, `%${name}%`);
      });
    }

    const [orders, total] = await queryBuilder.getManyAndCount();

    // Calculate grand total sum using a separate query for better performance
    const grandTotalQuery = this.orderRepository
      .createQueryBuilder('order')
      .leftJoin('order.customer', 'customer')
      .leftJoin('order.orderItems', 'orderItems')
      .leftJoin('orderItems.item', 'orderItemsItem')
      .leftJoin('orderItems.pricing', 'orderItemsPricing')
      .leftJoin('orderItems.service', 'orderItemsService')
      .leftJoin('orderItems.nonStockService', 'orderItemsNonStockService')
      .leftJoin('order.paymentTerm', 'paymentTerm')
      .leftJoin('paymentTerm.transactions', 'paymentTransactions')
      .leftJoin('order.commission', 'commission')
      .leftJoin('commission.transactions', 'commissionTransactions')
      .leftJoin('order.salesPartner', 'salesPartner')
      .select('SUM(order.grandTotal)', 'grandTotalSum');

    // Apply the same filters to the sum query
    if (search) {
      grandTotalQuery.where(
        '(order.id LIKE :search OR order.series LIKE :search OR customer.fullName LIKE :search OR customer.phone LIKE :search OR orderItems.description LIKE :search OR paymentTransactions.reference LIKE :search OR commissionTransactions.reference LIKE :search OR salesPartner.fullName LIKE :search)',
        { search: `%${search}%` }
      );
    }

    if (startDate && endDate) {
      grandTotalQuery.andWhere('order.orderDate BETWEEN :startDate AND :endDate', {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      });
    }

    if (orderItemNames.length > 0) {
      const itemConditions = orderItemNames.map((name, index) => 
        `orderItemsItem.name LIKE :item${index}`
      ).join(' OR ');
      
      grandTotalQuery.andWhere(`(${itemConditions})`);
      
      orderItemNames.forEach((name, index) => {
        grandTotalQuery.setParameter(`item${index}`, `%${name}%`);
      });
    }

    const grandTotalResult = await grandTotalQuery.getRawOne();
    const grandTotalSum = grandTotalResult?.grandTotalSum || 0;

    return {
      orders,
      total,
      grandTotalSum,
    };
  }

  async findAllOrders() {
    return this.orderRepository.find({
      relations: [
        'customer',
        'orderItems',
        'orderItems.item',
        'orderItems.item.machine',
        'orderItems.itemBase',
        'orderItems.pricing',
        'orderItems.service',
        'orderItems.nonStockService',
        'paymentTerm',
        'paymentTerm.transactions',
        'commission',
        'commission.transactions',
        'commission.salesPartner',
        'salesPartner'
      ],
      order: {
        createdAt: 'DESC',
        orderItems: {
          createdAt: 'DESC'
        }
      }
    });
  }

  async findOne(id: string) {
    return this.orderRepository.findOne({
      where: { id },
      relations: [
        'customer',
        'orderItems',
        'orderItems.item',
        'orderItems.item.machine',
        'orderItems.itemBase',
        'orderItems.pricing',
        'orderItems.service',
        'orderItems.nonStockService',
        'paymentTerm',
        'paymentTerm.transactions',
        'commission',
        'commission.transactions',
        'commission.salesPartner',
        'salesPartner'
      ],
    });
  }

  async update(id: string, updateOrderDto: UpdateOrderDto) {
    const { orderItems, paymentTerm, commission, salesPartner, ...orderData } = updateOrderDto;

    // Fetch the existing order and related data
    const existingOrder = await this.orderRepository.findOne({
      where: { id },
      relations: [
        'orderItems',
        'paymentTerm', 
        'paymentTerm.transactions',
        'commission', 
        'commission.transactions',
        'commission.salesPartner',
        'salesPartner'
      ],
    });

    if (!existingOrder) {
      throw new Error('Order not found');
    }

    // Validate missing fields for commission
    if (commission) {
      if (!commission.salesPartnerId) {
        throw new ConflictException('Sales partner for commission is missing.');
      }
      if (!commission.transactions || commission.transactions.length === 0) {
        throw new ConflictException('Commission transactions are missing.');
      }
      commission.transactions.forEach((transaction, index) => {
        if (!transaction.paymentMethod) {
          throw new ConflictException(`Payment method for commission transaction #${index + 1} is missing.`);
        }
        if (transaction.amount === null || transaction.amount === 0) {
          throw new ConflictException(`Amount for commission transaction #${index + 1} is missing.`);
        }
        if (transaction.percentage === null || transaction.percentage === 0) {
          throw new ConflictException(`Percentage for commission transaction #${index + 1} is missing.`);
        }
        if (transaction.date === null) {
          throw new ConflictException(`Date for commission transaction #${index + 1} is missing.`);
        }
        if (transaction.reference === null) {
          throw new ConflictException(`Reference for commission transaction #${index + 1} is missing.`);
        }
        if (transaction.status === null) {
          throw new ConflictException(`Status for commission transaction #${index + 1} is missing.`);
        }
      });
    }

    // Validate missing fields for paymentTerm (supports array or object)
    if (paymentTerm) {
      const paymentTermData = Array.isArray(paymentTerm) ? paymentTerm[0] : paymentTerm;
      if (!paymentTermData.transactions || paymentTermData.transactions.length === 0) {
        throw new BadRequestException('Payment term transactions are missing.');
      }
      paymentTermData.transactions.forEach((transaction, index) => {
        if (!transaction.paymentMethod) {
          throw new BadRequestException(`Payment method for payment term transaction #${index + 1} is missing.`);
        }
      });
    }

    // Extract existing IDs for comparison
    const existingOrderItemIds = existingOrder.orderItems.map(item => item.id);
    const newOrderItemIds = orderItems.map(item => item.id);
    const orderItemsToDelete = existingOrderItemIds.filter(id => !newOrderItemIds.includes(id));

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Update the main order
      await queryRunner.manager.update(Order, id, {
        series: orderData.series,
        customerId: orderData.customerId,
        status: orderData.status,
        orderDate: orderData.orderDate ? new Date(orderData.orderDate) : new Date(),
        deliveryDate: orderData.deliveryDate ? new Date(orderData.deliveryDate) : new Date(),
        orderSource: orderData.orderSource,
        totalAmount: parseFloat((orderData.totalAmount || 0).toString()),
        tax: parseFloat((orderData.tax || 0).toString()),
        grandTotal: parseFloat((orderData.grandTotal || 0).toString()),
        totalQuantity: parseFloat((orderData.totalQuantity || 0).toString()),
        internalNote: orderData.internalNote,
        fileNames: orderData.fileNames || [],
        adminApproval: orderData.adminApproval || false,
        salesPartnersId: salesPartner?.id,
        prescriptionDate: orderData.prescriptionDate ? new Date(orderData.prescriptionDate) : existingOrder.prescriptionDate,
        optometristName: orderData.optometristName ?? existingOrder.optometristName,
        urgency: orderData.urgency ?? existingOrder.urgency,
      });

      // Delete order items that are no longer present
      if (orderItemsToDelete.length > 0) {
        // Stock restoration is now handled when status changes in the order items service
        // Removed stock restoration from order update
        
        await queryRunner.manager.delete(OrderItems, { id: In(orderItemsToDelete) });
      }

      // Upsert order items with calculated totalCost and sales
      for (const item of orderItems) {
        const quantity = parseFloat((item.quantity || 0).toString());

        // Determine if this is a non-stock service
        const isNonStockService = item.isNonStockService || !!item.nonStockServiceId;
        const serviceId = isNonStockService ? item.nonStockServiceId : item.serviceId;

        let totalCostResult = { totalCost: 0, unit: 0, baseUomId: item.baseUomId || item.uomId };
        let salesResult = { sales: 0, unit: 0, baseUomId: item.baseUomId || item.uomId };

        try {
          totalCostResult = await this.calculateTotalCost(
            item.itemId,
            serviceId,
            item.uomId,
            quantity,
            isNonStockService,
            item.itemBaseId
          );
          salesResult = await this.calculateSales(
            item.itemId,
            serviceId,
            item.uomId,
            quantity,
            isNonStockService,
            item.itemBaseId
          );
        } catch (error) {
          console.warn(`Pricing calculation failed for item ${item.itemId}:`, error.message);
        }

        if (item.id) {
          // Update existing order item
          await queryRunner.manager.update(OrderItems, item.id, {
            itemId: item.itemId,
            itemBaseId: item.itemBaseId ?? null,
            serviceId: isNonStockService ? null : item.serviceId,
            nonStockServiceId: isNonStockService ? item.nonStockServiceId : null,
            isNonStockService: isNonStockService,
            discount: parseFloat((item.discount || 0).toString()),
            level: parseFloat((item.level || 0).toString()),
            // Lens / prescription fields
            sphereRight: item.sphereRight,
            sphereLeft: item.sphereLeft,
            cylinderRight: item.cylinderRight,
            cylinderLeft: item.cylinderLeft,
            axisRight: item.axisRight,
            axisLeft: item.axisLeft,
            prismRight: item.prismRight,
            prismLeft: item.prismLeft,
            addRight: item.addRight,
            addLeft: item.addLeft,
            pd: item.pd,
            pdMonocularRight: item.pdMonocularRight,
            pdMonocularLeft: item.pdMonocularLeft,
            lensType: item.lensType,
            lensMaterial: item.lensMaterial,
            lensCoating: item.lensCoating,
            lensIndex: item.lensIndex,
            baseCurve: item.baseCurve,
            diameter: item.diameter,
            tintColor: item.tintColor,
            totalAmount: parseFloat((item.totalAmount || 0).toString()),
            adminApproval: item.adminApproval || false,
            uomId: item.uomId,
            quantity: quantity,
            unitPrice: parseFloat((item.unitPrice || 0).toString()),
            description: item.description,
            isDiscounted: item.isDiscounted || false,
            status: item.status,
            pricingId: item.pricingId,
            unit: totalCostResult.unit || parseFloat((item.unit || 0).toString()),
            baseUomId: totalCostResult.baseUomId || item.baseUomId || item.uomId,
            totalCost: totalCostResult.totalCost || 0,
            sales: salesResult.sales || 0,
          });
        } else {
          // Create new order item
          await queryRunner.manager.save(OrderItems, {
            orderId: id,
            itemId: item.itemId,
            serviceId: isNonStockService ? null : item.serviceId,
            nonStockServiceId: isNonStockService ? item.nonStockServiceId : null,
            isNonStockService: isNonStockService,
            discount: parseFloat((item.discount || 0).toString()),
            level: parseFloat((item.level || 0).toString()),
            // Lens / prescription fields
            sphereRight: item.sphereRight,
            sphereLeft: item.sphereLeft,
            cylinderRight: item.cylinderRight,
            cylinderLeft: item.cylinderLeft,
            axisRight: item.axisRight,
            axisLeft: item.axisLeft,
            prismRight: item.prismRight,
            prismLeft: item.prismLeft,
            addRight: item.addRight,
            addLeft: item.addLeft,
            pd: item.pd,
            pdMonocularRight: item.pdMonocularRight,
            pdMonocularLeft: item.pdMonocularLeft,
            lensType: item.lensType,
            lensMaterial: item.lensMaterial,
            lensCoating: item.lensCoating,
            lensIndex: item.lensIndex,
            baseCurve: item.baseCurve,
            diameter: item.diameter,
            tintColor: item.tintColor,
            totalAmount: parseFloat((item.totalAmount || 0).toString()),
            adminApproval: item.adminApproval || false,
            uomId: item.uomId,
            quantity: quantity,
            unitPrice: parseFloat((item.unitPrice || 0).toString()),
            description: item.description,
            isDiscounted: item.isDiscounted || false,
            status: item.status,
            pricingId: item.pricingId,
            unit: totalCostResult.unit || parseFloat((item.unit || 0).toString()),
            baseUomId: totalCostResult.baseUomId || item.baseUomId || item.uomId,
            totalCost: totalCostResult.totalCost || 0,
            sales: salesResult.sales || 0,
          });
        }
      }

      // Handle payment term
      if (paymentTerm) {
        const paymentTermData = Array.isArray(paymentTerm) ? paymentTerm[0] : paymentTerm;
        const existingPaymentTerm = Array.isArray(existingOrder.paymentTerm)
          ? existingOrder.paymentTerm[0]
          : existingOrder.paymentTerm;

        const hasTransactions = paymentTermData.transactions && paymentTermData.transactions.length > 0;
        const remainingAmount = parseFloat((paymentTermData.remainingAmount || 0).toString());

        let paymentStatus = 'Not Paid';
        if (hasTransactions) {
          if (remainingAmount === 0) {
            paymentStatus = 'Fully Paid';
          } else if (remainingAmount > 0 && remainingAmount < orderData.grandTotal) {
            paymentStatus = 'Partially Paid';
          }
        }

        let paymentTermIdToUse: string;

        if (existingPaymentTerm?.id) {
          // Update existing payment term
          await queryRunner.manager.update(PaymentTerm, existingPaymentTerm.id, {
            orderId: id,
            totalAmount: parseFloat((paymentTermData.totalAmount || 0).toString()),
            remainingAmount: remainingAmount,
            status: paymentStatus,
            forcePayment: paymentTermData.forcePayment || false,
          });
          paymentTermIdToUse = existingPaymentTerm.id;

          // Replace existing transactions
          await queryRunner.manager.delete(PaymentTransaction, { paymentTermId: paymentTermIdToUse });
        } else {
          // Create new payment term
          const created = await queryRunner.manager.save(PaymentTerm, {
            orderId: id,
            totalAmount: parseFloat((paymentTermData.totalAmount || 0).toString()),
            remainingAmount: remainingAmount,
            status: paymentStatus,
            forcePayment: paymentTermData.forcePayment || false,
          });
          paymentTermIdToUse = created.id;
        }

        if (hasTransactions) {
          const paymentTransactions = paymentTermData.transactions.map(transaction => {
            const statusStr = typeof transaction.status === 'string' ? transaction.status.toLowerCase() : '';
            const normalizedStatus = statusStr === 'paid' ? 'Paid' : statusStr === 'pending' ? 'Pending' : (transaction.status || 'Pending');
            return this.paymentTransactionRepository.create({
              paymentTermId: paymentTermIdToUse,
              date: transaction.date ? new Date(transaction.date) : new Date(),
              paymentMethod: transaction.paymentMethod,
              reference: transaction.reference || '',
              amount: parseFloat((transaction.amount || 0).toString()),
              status: normalizedStatus,
              description: transaction.description || '',
            });
          });
          await queryRunner.manager.save(PaymentTransaction, paymentTransactions);
        }
      }

      // Handle commission
      if (commission) {
        // Delete existing commission and transactions if they exist
        if (existingOrder.commission && existingOrder.commission.length > 0) {
          await queryRunner.manager.delete(CommissionTransaction, { commissionId: existingOrder.commission[0].id });
          await queryRunner.manager.delete(Commission, { id: existingOrder.commission[0].id });
        }

        // Create new commission
        const newCommission = await queryRunner.manager.save(Commission, {
          orderId: id,
          salesPartnerId: commission.salesPartnerId,
          totalAmount: parseFloat((commission.totalAmount || 0).toString()),
          paidAmount: parseFloat((commission.paidAmount || 0).toString()),
        });

        // Create commission transactions
        if (commission.transactions?.length > 0) {
          const commissionTransactions = commission.transactions.map(transaction =>
            this.commissionTransactionRepository.create({
              commissionId: newCommission.id,
              date: transaction.date ? new Date(transaction.date) : new Date(),
              amount: parseFloat((transaction.amount || 0).toString()),
              percentage: parseFloat((transaction.percentage || 0).toString()),
              paymentMethod: transaction.paymentMethod,
              reference: transaction.reference,
              status: transaction.status,
              description: transaction.description,
            })
          );

          await queryRunner.manager.save(CommissionTransaction, commissionTransactions);
        }
      }

      await queryRunner.commitTransaction();

      // Return the updated order with all relations
      return await this.orderRepository.findOne({
        where: { id },
        relations: [
          'customer',
          'orderItems',
          'orderItems.pricing',
          'paymentTerm',
          'paymentTerm.transactions',
          'commission',
          'commission.transactions',
          'commission.salesPartner',
          'salesPartner'
        ],
      });

    } catch (error) {
      await queryRunner.rollbackTransaction();
      
      if (error.code === 'ER_DUP_ENTRY') {
        throw new ConflictException('Database constraint violation occurred. Please check your data.');
      }
      
      console.error('Error updating order:', error);
      throw new BadRequestException('Failed to update order');
    } finally {
      await queryRunner.release();
    }
  }

  async remove(id: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const order = await this.orderRepository.findOne({ 
        where: { id },
        relations: ['orderItems', 'paymentTerm', 'paymentTerm.transactions', 'commission', 'commission.transactions']
      });
      
      if (!order) {
        throw new NotFoundException(`Order with ID ${id} not found`);
      }

      // Check if all order items have "received" status
      if (order.orderItems && order.orderItems.length > 0) {
        const nonReceivedItems = order.orderItems.filter(item => item.status !== 'Received');
        if (nonReceivedItems.length > 0) {
          throw new ConflictException(
            `Cannot delete order. Order items with IDs [${nonReceivedItems.map(item => item.id).join(', ')}] are not in "received" status. Order is still in process.`
          );
        }
      }

      // Delete related entities in the correct order
      
      // 1. Delete commission transactions first
      if (order.commission && order.commission.length > 0) {
        for (const commission of order.commission) {
          if (commission.transactions && commission.transactions.length > 0) {
            await queryRunner.manager.delete(CommissionTransaction, { commissionId: commission.id });
          }
        }
      }

      // 2. Delete commissions
      if (order.commission && order.commission.length > 0) {
        await queryRunner.manager.delete(Commission, { orderId: id });
      }

      // 3. Delete payment transactions first
      if (order.paymentTerm && order.paymentTerm.length > 0) {
        for (const paymentTerm of order.paymentTerm) {
          if (paymentTerm.transactions && paymentTerm.transactions.length > 0) {
            await queryRunner.manager.delete(PaymentTransaction, { paymentTermId: paymentTerm.id });
          }
        }
      }

      // 4. Delete payment terms
      if (order.paymentTerm && order.paymentTerm.length > 0) {
        await queryRunner.manager.delete(PaymentTerm, { orderId: id });
      }

      // 5. Delete order items
      if (order.orderItems && order.orderItems.length > 0) {
        await queryRunner.manager.delete(OrderItems, { orderId: id });
      }

      // 6. Finally delete the order
      await queryRunner.manager.delete(Order, { id: id });

      await queryRunner.commitTransaction();

      return { message: `Order with ID ${id} has been successfully deleted` };

    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error('Error deleting order:', error);
      
      if (error instanceof NotFoundException) {
        throw error;
      }
      
      throw new Error('An unexpected error occurred while deleting the order.');
    } finally {
      await queryRunner.release();
    }
  }

  getPaymentTermStatus(remainingAmount: number, grandTotal: number) {
    if (remainingAmount > 0 && remainingAmount < grandTotal) {
      return 'Partially Paid';
    } else if (remainingAmount === 0) {
      return 'Fully Paid';
    } else if (remainingAmount === grandTotal) {
      return 'Not Paid';
    } else {
      return 'Not Paid'; // Default case
    }
  }

  // Calculate unit and base UOM for a quantity using UOM conversion
  private async calculateUnitForQuantity(
    itemId: string,
    serviceId: string | null,
    uomId: string,
    quantity: number,
    _itemBaseId?: string | null
  ): Promise<{ unitPrice: number; unit: number; baseUomId: string }> {
    const item = await this.itemRepository.findOne({
      where: { id: itemId },
      relations: ['unitCategory', 'unitCategory.uoms']
    });

    if (!item || !item.unitCategory) {
      throw new BadRequestException(`Item or unit category not found for item ${itemId}`);
    }

    const foundUom = item.unitCategory.uoms.find(uom => uom.id === uomId);
    if (!foundUom) {
      throw new BadRequestException(`UOM ${uomId} not found for item ${itemId}`);
    }

    const baseUnit = item.unitCategory.uoms.find(unit => unit.baseUnit === true);
    if (!baseUnit) {
      throw new BadRequestException(`Base unit not found for item ${itemId}`);
    }

    // Calculate converted quantity (matches frontend: quantity * conversionRate)
    const convertedQuantity = quantity * foundUom.conversionRate;
    const unit = convertedQuantity;

    return { unitPrice: 0, unit, baseUomId: baseUnit.id };
  }

  // Calculate total cost for an order item
  private async calculateTotalCost(
    itemId: string,
    serviceId: string | null,
    uomId: string,
    quantity: number,
    isNonStockService: boolean = false,
    itemBaseId?: string | null
  ): Promise<{ totalCost: number; unit: number; baseUomId: string }> {
    const item = await this.itemRepository.findOne({
      where: { id: itemId },
      relations: ['unitCategory']
    });

    if (!item || !item.unitCategory) {
      throw new BadRequestException(`Item or unit category not found for item ${itemId}`);
    }

    let pricing;
    if (serviceId) {
      if (isNonStockService) {
        pricing = await this.pricingRepository.findOne({
          where: { itemId, nonStockServiceId: serviceId, isNonStockService: true }
        });
      } else {
        pricing = await this.pricingRepository.findOne({
          where: { itemId, serviceId, isNonStockService: false }
        });
      }
    } else {
      // Item-only (eyeglass): pricing by item + optional itemBase
      pricing = await this.pricingRepository.findOne({
        where: {
          itemId,
          ...(itemBaseId ? { itemBaseId } : { itemBaseId: IsNull() }),
          serviceId: IsNull(),
          nonStockServiceId: IsNull(),
        },
      });
    }

    if (!pricing) {
      // Return default values if no pricing is found
      return { totalCost: 0, unit: 0, baseUomId: uomId };
    }

    const { unit, baseUomId } = await this.calculateUnitForQuantity(itemId, serviceId, uomId, quantity, itemBaseId);

    const totalCost = unit * (pricing.costPrice || 0);
    return { totalCost, unit, baseUomId };
  }

  // Calculate sales for an order item
  private async calculateSales(
    itemId: string,
    serviceId: string | null,
    uomId: string,
    quantity: number,
    isNonStockService: boolean = false,
    itemBaseId?: string | null
  ): Promise<{ sales: number; unit: number; baseUomId: string }> {
    const item = await this.itemRepository.findOne({
      where: { id: itemId },
      relations: ['unitCategory']
    });

    if (!item || !item.unitCategory) {
      throw new BadRequestException(`Item or unit category not found for item ${itemId}`);
    }

    const { unit, baseUomId } = await this.calculateUnitForQuantity(itemId, serviceId, uomId, quantity, itemBaseId);

    let pricing;
    if (serviceId) {
      if (isNonStockService) {
        pricing = await this.pricingRepository.findOne({
          where: { itemId, nonStockServiceId: serviceId, isNonStockService: true }
        });
      } else {
        pricing = await this.pricingRepository.findOne({
          where: { itemId, serviceId, isNonStockService: false }
        });
      }
    } else {
      pricing = await this.pricingRepository.findOne({
        where: {
          itemId,
          ...(itemBaseId ? { itemBaseId } : { itemBaseId: IsNull() }),
          serviceId: IsNull(),
          nonStockServiceId: IsNull(),
        },
      });
    }

    if (!pricing) {
      // Return default values if no pricing is found
      return { sales: 0, unit: 0, baseUomId: uomId };
    }

    // Calculate sales using selling price
    const sales = unit * pricing.sellingPrice;

    return { sales, unit, baseUomId };
  }

  // Get total daily fixed cost (always sum dailyFixedCost, ignore monthly)
  private async getTotalDailyFixedCost(): Promise<number> {
    const fixedCosts = await this.fixedCostRepository.find();
    // Always sum dailyFixedCost, ignore monthlyFixedCost
    const totalDailyCost = fixedCosts.reduce((total, fixedCost) => {
      return total + (fixedCost.dailyFixedCost || 0);
    }, 0);
    return totalDailyCost;
  }

  // Get total daily fixed cost for a specific date range
  private async getTotalDailyFixedCostForDateRange(startDate: Date, endDate: Date): Promise<number> {
    const fixedCosts = await this.fixedCostRepository.find();
    
    // Calculate the number of days in the date range (inclusive)
    const start = new Date(startDate);
    const end = new Date(endDate);
    const timeDiff = end.getTime() - start.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1; // +1 to include both start and end dates
    
    console.log(`📅 Date range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]} (${daysDiff} days)`);
    
    // Calculate total fixed cost for the period
    // If monthlyFixedCost is provided, use it to calculate daily cost
    // Otherwise, use the dailyFixedCost directly
    const totalFixedCost = fixedCosts.reduce((total, fixedCost) => {
      let costForPeriod = 0;
      
      if (fixedCost.monthlyFixedCost > 0) {
        // Convert monthly to daily (assuming 30 days per month)
        const dailyCost = fixedCost.monthlyFixedCost / 30;
        costForPeriod = dailyCost * daysDiff;
        console.log(`💰 ${fixedCost.description}: $${fixedCost.monthlyFixedCost}/month = $${dailyCost.toFixed(2)}/day × ${daysDiff} days = $${costForPeriod.toFixed(2)}`);
      } else {
        // Use dailyFixedCost directly
        costForPeriod = fixedCost.dailyFixedCost * daysDiff;
        console.log(`💰 ${fixedCost.description}: $${fixedCost.dailyFixedCost}/day × ${daysDiff} days = $${costForPeriod.toFixed(2)}`);
      }
      
      return total + costForPeriod;
    }, 0);
    
    console.log(`📊 Total fixed cost for period: $${totalFixedCost.toFixed(2)}`);
    return totalFixedCost;
  }

  // Calculate profit for an order item
  private async calculateProfit(
    orderItem: OrderItems,
    commissionAmount: number = 0
  ): Promise<number> {
    const totalDailyFixedCost = await this.getTotalDailyFixedCost();
    const profit = orderItem.sales - orderItem.totalCost - commissionAmount - totalDailyFixedCost;
    return Math.max(0, profit); // Ensure profit is not negative
  }

  // Calculate profit for entire order
  async calculateOrderProfit(orderId: string): Promise<{
    totalSales: number;
    totalCost: number;
    totalCommission: number;
    totalDailyFixedCost: number;
    totalProfit: number;
    orderItemsProfit: Array<{
      orderItemId: string;
      sales: number;
      totalCost: number;
      commission: number;
      profit: number;
    }>;
  }> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: [
        'orderItems',
        'commission',
        'commission.transactions'
      ]
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const totalDailyFixedCost = await this.getTotalDailyFixedCost();
    let totalSales = 0;
    let totalCost = 0;
    let totalCommission = 0;
    const orderItemsProfit = [];

    for (const orderItem of order.orderItems) {
      const sales = orderItem.sales;
      const cost = orderItem.totalCost;
      
      // Calculate commission for this order item (proportional to sales)
      const orderTotalSales = order.orderItems.reduce((sum, item) => sum + item.sales, 0);
      const orderTotalCommission = order.commission?.reduce((sum, comm) => 
        sum + comm.transactions.reduce((tSum, trans) => tSum + trans.amount, 0), 0) || 0;
      
      const commissionAmount = orderTotalSales > 0 ? (sales / orderTotalSales) * orderTotalCommission : 0;
      const profit = await this.calculateProfit(orderItem, commissionAmount);

      totalSales += sales;
      totalCost += cost;
      totalCommission += commissionAmount;

      orderItemsProfit.push({
        orderItemId: orderItem.id,
        sales,
        totalCost: cost,
        commission: commissionAmount,
        profit
      });
    }

    const totalProfit = totalSales - totalCost - totalCommission - totalDailyFixedCost;

    return {
      totalSales,
      totalCost,
      totalCommission,
      totalDailyFixedCost,
      totalProfit: Math.max(0, totalProfit),
      orderItemsProfit
    };
  }

  // Calculate profit for filtered orders with date range
  async calculateFilteredOrdersProfit(
    startDate?: string,
    endDate?: string,
    search?: string,
    item1?: string,
    item2?: string,
    item3?: string
  ): Promise<{
    totalSales: number;
    totalCost: number;
    totalCommission: number;
    totalDailyFixedCost: number;
    totalProfit: number;
    numberOfDays: number;
    ordersCount: number;
    profitBreakdown: {
      totalSales: number;
      totalCost: number;
      totalCommission: number;
      totalFixedCost: number;
      netProfit: number;
    };
    orderItemsProfit: Array<{
      orderItemId: string;
      orderId: string;
      itemName?: string;
      serviceName?: string;
      sales: number;
      totalCost: number;
      commission: number;
      fixedCostAllocation: number;
      profit: number;
      profitBreakdown: {
        sales: number;
        cost: number;
        commission: number;
        fixedCost: number;
        netProfit: number;
      };
    }>;
  }> {
    // Build the same query as findAll method
    const queryBuilder = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.customer', 'customer')
      .leftJoinAndSelect('order.orderItems', 'orderItems')
      .leftJoinAndSelect('orderItems.item', 'orderItemsItem')
      .leftJoinAndSelect('orderItems.pricing', 'orderItemsPricing')
      .leftJoinAndSelect('order.paymentTerm', 'paymentTerm')
      .leftJoinAndSelect('paymentTerm.transactions', 'paymentTransactions')
      .leftJoinAndSelect('order.commission', 'commission')
      .leftJoinAndSelect('commission.transactions', 'commissionTransactions')
      .leftJoinAndSelect('order.salesPartner', 'salesPartner');

    // Handle search filter
    if (search) {
      queryBuilder.where(
        '(order.id LIKE :search OR order.series LIKE :search OR customer.fullName LIKE :search OR customer.phone LIKE :search OR orderItems.description LIKE :search OR paymentTransactions.reference LIKE :search OR commissionTransactions.reference LIKE :search OR salesPartner.fullName LIKE :search)',
        { search: `%${search}%` }
      );
    }

    // Handle date range filter
    if (startDate && endDate) {
      queryBuilder.andWhere('order.orderDate BETWEEN :startDate AND :endDate', {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      });
    }

    // Collect the provided item names into an array
    const orderItemNames = [item1, item2, item3].filter(Boolean);

    // Handle order item names filter
    if (orderItemNames.length > 0) {
      const itemConditions = orderItemNames.map((name, index) => 
        `orderItemsItem.name LIKE :item${index}`
      ).join(' OR ');
      
      queryBuilder.andWhere(`(${itemConditions})`);
      
      orderItemNames.forEach((name, index) => {
        queryBuilder.setParameter(`item${index}`, `%${name}%`);
      });
    }

    const orders = await queryBuilder.getMany();

    // Calculate total daily fixed cost for the date range
    let totalDailyFixedCost = 0;
    let numberOfDays = 0;

    if (startDate && endDate) {
      totalDailyFixedCost = await this.getTotalDailyFixedCostForDateRange(
        new Date(startDate),
        new Date(endDate)
      );
      
      // Calculate number of days
      const start = new Date(startDate);
      const end = new Date(endDate);
      const timeDiff = end.getTime() - start.getTime();
      numberOfDays = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
    } else {
      // If no date range, use single day
      totalDailyFixedCost = await this.getTotalDailyFixedCost();
      numberOfDays = 1;
    }

    let totalSales = 0;
    let totalCost = 0;
    let totalCommission = 0;
    const orderItemsProfit = [];

    // Process each order
    for (const order of orders) {
      for (const orderItem of order.orderItems) {
        const sales = orderItem.sales;
        const cost = orderItem.totalCost;
        
        // Calculate commission for this order item (proportional to sales)
        const orderTotalSales = order.orderItems.reduce((sum, item) => sum + item.sales, 0);
        const orderTotalCommission = order.commission?.reduce((sum, comm) => 
          sum + comm.transactions.reduce((tSum, trans) => tSum + trans.amount, 0), 0) || 0;
        
        const commissionAmount = orderTotalSales > 0 ? (sales / orderTotalSales) * orderTotalCommission : 0;
        
        // Calculate profit per order item (without fixed cost since we'll distribute it)
        const itemProfit = sales - cost - commissionAmount;

        totalSales += sales;
        totalCost += cost;
        totalCommission += commissionAmount;

        orderItemsProfit.push({
          orderItemId: orderItem.id,
          orderId: order.id,
          itemName: orderItem.item?.name,
          serviceName: orderItem.service?.name,
          sales,
          totalCost: cost,
          commission: commissionAmount,
          fixedCostAllocation: 0, // Will be calculated later
          profit: Math.max(0, itemProfit),
          profitBreakdown: {
            sales,
            cost,
            commission: commissionAmount,
            fixedCost: 0, // Will be calculated later
            netProfit: Math.max(0, itemProfit)
          }
        });
      }
    }

    // Distribute the total daily fixed cost proportionally among all order items
    if (orderItemsProfit.length > 0) {
      const totalProfitBeforeFixedCost = totalSales - totalCost - totalCommission;
      
      if (totalProfitBeforeFixedCost > 0) {
        const fixedCostPerProfitUnit = totalDailyFixedCost / totalProfitBeforeFixedCost;

        // Apply fixed cost to each order item proportionally
        orderItemsProfit.forEach(item => {
          const itemProfitBeforeFixedCost = item.sales - item.totalCost - item.commission;
          const fixedCostForItem = itemProfitBeforeFixedCost > 0 ? 
            itemProfitBeforeFixedCost * fixedCostPerProfitUnit : 0;
          
          item.fixedCostAllocation = fixedCostForItem;
          item.profit = Math.max(0, itemProfitBeforeFixedCost - fixedCostForItem);
          item.profitBreakdown.fixedCost = fixedCostForItem;
          item.profitBreakdown.netProfit = item.profit;
        });
      } else {
        // If no profit before fixed cost, distribute fixed cost equally among all items
        const fixedCostPerItem = totalDailyFixedCost / orderItemsProfit.length;
        orderItemsProfit.forEach(item => {
          item.fixedCostAllocation = fixedCostPerItem;
          item.profit = Math.max(0, item.sales - item.totalCost - item.commission - fixedCostPerItem);
          item.profitBreakdown.fixedCost = fixedCostPerItem;
          item.profitBreakdown.netProfit = item.profit;
        });
      }
    }

    const totalProfit = totalSales - totalCost - totalCommission - totalDailyFixedCost;

    return {
      totalSales,
      totalCost,
      totalCommission,
      totalDailyFixedCost,
      totalProfit: Math.max(0, totalProfit),
      numberOfDays,
      ordersCount: orders.length,
      profitBreakdown: {
        totalSales,
        totalCost,
        totalCommission,
        totalFixedCost: totalDailyFixedCost,
        netProfit: Math.max(0, totalProfit)
      },
      orderItemsProfit
    };
  }

  // Generate company report in Excel format
  async generateCompanyReport(
    skip: number = 0,
    take: number = 10,
    startDate?: string,
    endDate?: string,
    search?: string,
    item1?: string,
    item2?: string,
    item3?: string
  ): Promise<{
    reportData: Array<{
      date: string;
      customerName: string;
      unit: number; // width * height
      quantity: number;
      metersquare: number; // width * height * quantity
      costPrice: number;
      totalCost: number; // metersquare * costPrice
      sellingPrice: number;
      sales: number; // metersquare * sellingPrice
      commission: number;
      dailyFixedCost: number;
      dailyFixedCostPerDay: number; // Total daily fixed cost for the entire day
      profit: number;
      orderId: string;
      itemName: string;
      serviceName: string;
      uom: {
        id: string;
        name: string;
        abbreviation: string;
        conversionRate: number;
      };
      baseUom: {
        id: string;
        name: string;
        abbreviation: string;
        conversionRate: number;
      };
    }>;
    totals: {
      totalQuantity: number;
      totalMetersquare: number;
      totalCost: number;
      totalSales: number;
      totalCommission: number;
      totalDailyFixedCost: number;
      totalProfit: number;
      numberOfDays: number;
      ordersCount: number;
      constantDailyFixedCost: number;
    };
    pagination: {
      page: number;
      limit: number;
      totalItems: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
  }> {
    // Build the same query as findAll method
    const queryBuilder = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.customer', 'customer')
      .leftJoinAndSelect('order.orderItems', 'orderItems')
      .leftJoinAndSelect('orderItems.item', 'orderItemsItem')
      .leftJoinAndSelect('orderItems.service', 'orderItemsService')
      .leftJoinAndSelect('orderItems.pricing', 'orderItemsPricing')
      .leftJoinAndSelect('orderItems.uom', 'orderItemsUom')
      .leftJoinAndSelect('orderItems.baseUom', 'orderItemsBaseUom')
      .leftJoinAndSelect('order.paymentTerm', 'paymentTerm')
      .leftJoinAndSelect('paymentTerm.transactions', 'paymentTransactions')
      .leftJoinAndSelect('order.commission', 'commission')
      .leftJoinAndSelect('commission.transactions', 'commissionTransactions')
      .leftJoinAndSelect('order.salesPartner', 'salesPartner');

    // Handle search filter
    if (search) {
      queryBuilder.where(
        '(order.id LIKE :search OR order.series LIKE :search OR customer.fullName LIKE :search OR customer.phone LIKE :search OR orderItems.description LIKE :search OR paymentTransactions.reference LIKE :search OR commissionTransactions.reference LIKE :search OR salesPartner.fullName LIKE :search)',
        { search: `%${search}%` }
      );
    }

    // Handle date range filter
    if (startDate && endDate) {
      queryBuilder.andWhere('order.orderDate BETWEEN :startDate AND :endDate', {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      });
    }

    // Collect the provided item names into an array
    const orderItemNames = [item1, item2, item3].filter(Boolean);

    // Handle order item names filter
    if (orderItemNames.length > 0) {
      const itemConditions = orderItemNames.map((name, index) => 
        `orderItemsItem.name LIKE :item${index}`
      ).join(' OR ');
      
      queryBuilder.andWhere(`(${itemConditions})`);
      
      orderItemNames.forEach((name, index) => {
        queryBuilder.setParameter(`item${index}`, `%${name}%`);
      });
    }

    const orders = await queryBuilder.getMany();

    // Get the sum of all daily fixed costs
    const dailyFixedCost = await this.getTotalDailyFixedCost();
    
    // Calculate number of days in the date range
    let numberOfDays = 1;
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const timeDiff = end.getTime() - start.getTime();
      numberOfDays = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1; // +1 to include both start and end dates
    }
    
    // Calculate total fixed cost for the entire period (daily fixed cost × number of days)
    const totalFixedCostForPeriod = dailyFixedCost * numberOfDays;
    
    // Remove grouping by date. Just process all orders in descending order by orderDate.
    const allReportData = [];
    let totalQuantity = 0;
    let totalMetersquare = 0;
    let totalCost = 0;
    let totalSales = 0;
    let totalCommission = 0;

    // Process each order and its items (orders are already sorted by orderDate DESC)
    for (const order of orders) {
      for (const orderItem of order.orderItems) {
        const unit = orderItem.unit || orderItem.quantity || 0;
        const metersquare = unit; // for eyeglass, treat unit as the measurement basis
        const pricing = orderItem.pricing;
        if (!pricing) continue;

        const totalCostForItem = metersquare * (pricing.costPrice || 0);
        const salesForItem = metersquare * pricing.sellingPrice;
        
        const orderTotalSales = order.orderItems.reduce((s, item) => {
          const itemUnit = item.unit || item.quantity || 0;
          const itemMetersquare = itemUnit;
          const itemPricing = item.pricing;
          return s + (itemMetersquare * (itemPricing?.sellingPrice || 0));
        }, 0);
        
        const orderTotalCommission = order.commission?.reduce((s, comm) => 
          s + comm.transactions.reduce((tSum, trans) => tSum + trans.amount, 0), 0) || 0;
        
        const commissionAmount = orderTotalSales > 0 ? (salesForItem / orderTotalSales) * orderTotalCommission : 0;
        
        // Profit before fixed costs (no allocation)
        const profitBeforeFixedCost = salesForItem - totalCostForItem - commissionAmount;

        allReportData.push({
          date: order.orderDate.toISOString().split('T')[0],
          customerName: order.customer?.fullName || 'Unknown',
          unit: unit,
          quantity: orderItem.quantity,
          metersquare: metersquare,
          costPrice: pricing.costPrice || 0,
          totalCost: totalCostForItem,
          sellingPrice: pricing.sellingPrice,
          sales: salesForItem,
          commission: commissionAmount,
          dailyFixedCost: 0, // No allocation per item
          dailyFixedCostPerDay: dailyFixedCost, // Daily fixed cost per day
          profit: Math.max(0, profitBeforeFixedCost), // Profit before fixed costs
          orderId: order.id,
          itemName: orderItem.item?.name || 'Unknown',
          serviceName: orderItem.service?.name || 'Unknown',
          uom: {
            id: orderItem.uom?.id || '',
            name: orderItem.uom?.name || 'Unknown',
            abbreviation: orderItem.uom?.abbreviation || '',
            conversionRate: orderItem.uom?.conversionRate || 0
          },
          baseUom: {
            id: orderItem.baseUom?.id || '',
            name: orderItem.baseUom?.name || 'Unknown',
            abbreviation: orderItem.baseUom?.abbreviation || '',
            conversionRate: orderItem.baseUom?.conversionRate || 0
          }
        });

        totalQuantity += orderItem.quantity;
        totalMetersquare += metersquare;
        totalCost += totalCostForItem;
        totalSales += salesForItem;
        totalCommission += commissionAmount;
      }
      // Don't add daily fixed cost per order - it should be calculated for the entire period
    }

    // Sort allReportData by date DESC to ensure correct order
    allReportData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    // Apply pagination
    const totalItems = allReportData.length;
    const page = Math.floor(skip / take) + 1;
    const totalPages = Math.ceil(totalItems / take);
    const reportData = allReportData.slice(skip, skip + take);

    const totals = {
      totalQuantity,
      totalMetersquare,
      totalCost,
      totalSales,
      totalCommission,
      totalDailyFixedCost: totalFixedCostForPeriod, // Use total fixed cost for the entire period
      totalProfit: totalSales - totalCost - totalCommission - totalFixedCostForPeriod,
      numberOfDays,
      constantDailyFixedCost: dailyFixedCost,
      ordersCount: reportData.length
    };

    const pagination = {
      page,
      limit: take,
      totalItems,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1
    };

    return {
      reportData,
      totals,
      pagination
    };
  }
}
