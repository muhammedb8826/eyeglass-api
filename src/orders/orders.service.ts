import { ConflictException, Injectable, NotFoundException, BadRequestException, HttpException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In, IsNull, SelectQueryBuilder } from 'typeorm';
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
import { ItemBase } from 'src/entities/item-base.entity';
import { UOM } from 'src/entities/uom.entity';
import { UnitCategory } from 'src/entities/unit-category.entity';
import { LabToolService } from 'src/lab-tool/lab-tool.service';
import { assertWorkflowOnlyOrderItemPayload } from 'src/order-items/order-item-workflow.guard';
import { User } from 'src/entities/user.entity';
import { PermissionsService } from 'src/permissions/permissions.service';
import {
  assertCanManageApprovals,
  isApprovedLabel,
} from 'src/approvals/approval-authority.util';
import {
  isValidDatePreset,
  OrderDatePreset,
  OrderListDateField,
  OrderListSortField,
  parseStatusQuery,
  resolveOrderDateFilter,
  ResolvedOrderDateFilter,
} from './utils/order-list-filters.util';
import { NotificationsService } from 'src/notifications/notifications.service';

export type OrderListQueryInput = {
  search?: string;
  startDate?: string;
  endDate?: string;
  /** today | this_week | this_month | last_week | last_month (hyphens allowed) */
  datePreset?: string;
  /** Which timestamp column presets / custom range apply to (default orderDate) */
  dateField?: string;
  /** Comma-separated, e.g. Pending,Processing */
  status?: string;
  sortBy?: string;
  sortOrder?: string;
  customerId?: string;
  minGrandTotal?: string;
  maxGrandTotal?: string;
  item1?: string;
  item2?: string;
  item3?: string;
};

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
    @InjectRepository(ItemBase)
    private readonly itemBaseRepository: Repository<ItemBase>,
    @InjectRepository(UOM)
    private readonly uomRepository: Repository<UOM>,
    @InjectRepository(UnitCategory)
    private readonly unitCategoryRepository: Repository<UnitCategory>,
    private readonly dataSource: DataSource,
    private readonly labToolService: LabToolService,
    private readonly permissionsService: PermissionsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Validates that all order items with itemBaseId and Rx have lab tools available for the
   * tool values derived from Rx + base. Only checks the eye(s) being produced (quantityRight > 0, quantityLeft > 0).
   * Public so OrderItemsService can call it after PATCH order-items/:id.
   */
  async ensureLabToolsAvailableForOrderItems(orderItems: OrderItems[]): Promise<void> {
    if (!orderItems.length) return;

    const itemBaseIds = Array.from(
      new Set(
        orderItems
          .map(oi => oi.itemBaseId)
          .filter((id): id is string => !!id),
      ),
    );

    const baseMap = new Map<string, ItemBase>();
    if (itemBaseIds.length > 0) {
      const bases = await this.itemBaseRepository.find({
        where: { id: In(itemBaseIds) },
      });
      for (const b of bases) {
        baseMap.set(b.id, b);
      }
    }

    const toolValues: number[] = [];

    for (const oi of orderItems) {
      if (!oi.itemBaseId) continue;
      const base = baseMap.get(oi.itemBaseId);
      if (!base || !base.baseCode) continue;

      const baseCodeNum = parseFloat(base.baseCode);
      if (Number.isNaN(baseCodeNum)) continue;

      // BaseTool is base code plus ADD in 0.25D steps (e.g. 350 + 25 = 375 for 350^+2.5)
      const addTool = base.addPower ? Math.round(base.addPower * 10) : 0;
      const baseTool = baseCodeNum + addTool;

      const valuesTool: number[] = [];

      const addEyeValues = (
        sphere: number | null,
        cylinder: number | null,
      ) => {
        if (sphere === null || sphere === undefined) {
          return;
        }

        const sphAbs = Math.abs(sphere);
        // Frontend may send sphere as 0.01 diopter units (e.g. 200 = 2.00 D) or as diopters (e.g. 2.0)
        const sphMagTool =
          Number.isInteger(sphAbs) && sphAbs >= 0 && sphAbs <= 4000
            ? sphAbs
            : Math.round(sphAbs * 100);
        let sphTool = baseTool;
        if (sphere < 0) {
          sphTool = baseTool + sphMagTool;
        } else if (sphere > 0) {
          sphTool = baseTool - sphMagTool;
        }
        valuesTool.push(sphTool);

        if (cylinder === null || cylinder === undefined) {
          return;
        }

        const cylAbs = Math.abs(cylinder);
        let cylToolMag: number;

        // Frontend may send cylinder as tool units (e.g. 325) or diopters (e.g. 3.25)
        if (Number.isInteger(cylAbs) && cylAbs >= 25 && cylAbs % 25 === 0) {
          cylToolMag = cylAbs;
        } else {
          cylToolMag = Math.round(cylAbs * 100);
        }

        const cylTool = sphTool + cylToolMag;
        valuesTool.push(cylTool);
      };

      // Per-eye producibility: only require lab tools for the eye(s) being produced (quantityRight / quantityLeft)
      const qtyRight = Number(oi.quantityRight ?? (oi.quantity ?? 0));
      const qtyLeft = Number(oi.quantityLeft ?? 0);
      if (qtyRight > 0) {
        addEyeValues(oi.sphereRight, oi.cylinderRight);
      }
      if (qtyLeft > 0) {
        addEyeValues(oi.sphereLeft, oi.cylinderLeft);
      }

      for (const v of valuesTool) {
        if (Number.isFinite(v)) {
          toolValues.push(v);
        }
      }
    }

    if (toolValues.length === 0) {
      // Nothing to validate (no bases or no Rx on any items)
      return;
    }

    const { missing } = await this.labToolService.checkAvailabilityForBaseCurves(toolValues);
    if (missing.length > 0) {
      throw new BadRequestException(
        `Cannot produce order: no lab tool available for calculated base/tool value(s) ${missing.join(
          ', ',
        )}. Add or restock these tools.`,
      );
    }
  }

  async create(createOrderDto: CreateOrderDto, user?: User | null) {
    const wantsOrderApproval =
      createOrderDto.adminApproval === true ||
      createOrderDto.orderItems.some(
        (oi) =>
          isApprovedLabel(oi.approvalStatus) || oi.adminApproval === true,
      );
    if (wantsOrderApproval) {
      await assertCanManageApprovals(
        this.permissionsService,
        user,
        'Creating an order with admin or line approval',
      );
    }

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
        grandTotal: parseFloat((createOrderDto.grandTotal || 0).toString()),
        totalQuantity: parseFloat((createOrderDto.totalQuantity || 0).toString()),
        internalNote: createOrderDto.internalNote,
        adminApproval: createOrderDto.adminApproval || false,
        salesPartnersId: createOrderDto.salesPartner?.id,
        prescriptionDate: createOrderDto.prescriptionDate ? new Date(createOrderDto.prescriptionDate) : null,
        optometristName: createOrderDto.optometristName,
        urgency: createOrderDto.urgency,
      });

      const savedOrder = await queryRunner.manager.save(Order, order);

      // Normalize empty strings to null for UUID columns (Postgres rejects "" as UUID)
      const normUuid = (v: string | null | undefined) => (v && String(v).trim() !== '' ? v : null);

      // Create order items with calculated totalCost and sales (use resolved pricing)
      const orderItems = await Promise.all(resolvedOrderItems.map(async (item) => {
        const hasPerEye = item.quantityRight !== undefined || item.quantityLeft !== undefined;
        const quantityRight = hasPerEye ? parseFloat((item.quantityRight ?? 0).toString()) : parseFloat((item.quantity || 0).toString());
        const quantityLeft = hasPerEye ? parseFloat((item.quantityLeft ?? 0).toString()) : 0;
        const quantity = quantityRight + quantityLeft;

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

        // Use calculated sales when payload sends 0 so item/order totals are correct
        const payloadTotal = parseFloat((item.totalAmount || 0).toString());
        const payloadUnitPrice = parseFloat((item.unitPrice || 0).toString());
        const totalAmount = payloadTotal > 0 ? payloadTotal : (salesResult.sales ?? 0);
        const unitPrice = payloadUnitPrice > 0 ? payloadUnitPrice : (quantity > 0 ? totalAmount / quantity : 0);

        return this.orderItemsRepository.create({
          orderId: savedOrder.id,
          itemId: item.itemId,
          itemBaseId: normUuid(item.itemBaseId),
          serviceId: item.isNonStockService ? null : normUuid(item.serviceId),
          nonStockServiceId: item.isNonStockService ? normUuid(item.nonStockServiceId) : null,
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
          totalAmount,
          adminApproval: item.adminApproval || false,
          uomId: item.uomId,
          quantity,
          quantityRight,
          quantityLeft,
          unitPrice,
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

      // Recalculate order totals from the created items
      const recalculatedTotalAmount = orderItems.reduce((sum, oi) => sum + (oi.totalAmount || 0), 0);
      const recalculatedTotalQuantity = orderItems.reduce((sum, oi) => sum + (oi.quantity || 0), 0);
      const recalculatedGrandTotal = recalculatedTotalAmount;

      await queryRunner.manager.update(Order, savedOrder.id, {
        totalAmount: recalculatedTotalAmount,
        totalQuantity: recalculatedTotalQuantity,
        grandTotal: recalculatedGrandTotal,
      });

      // Ensure required lab tools (based on Rx + base) exist before order can be produced
      await this.ensureLabToolsAvailableForOrderItems(orderItems);

      // Stock reduction is now handled when status changes to "InProgress" in the order items service
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

        if (paymentTermData.forcePayment && (Number(paymentTermData.totalAmount || 0) <= 0 || remainingAmount > 0)) {
          const anyApprovedLine = createOrderDto.orderItems.some(
            oi => oi.approvalStatus === 'Approved',
          );
          if (createOrderDto.adminApproval || anyApprovedLine) {
            throw new ConflictException(
              'Cannot approve the order or any line while force payment is enabled until payment is complete.',
            );
          }
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

      await this.notificationsService.notifyAllActiveUsers({
        type: 'ORDER',
        title: `Order created: ${createOrderDto.series}`,
        message: `Status ${createOrderDto.status}. ${createOrderDto.orderItems.length} line(s).`,
        data: {
          orderId: savedOrder.id,
          series: createOrderDto.series,
          status: createOrderDto.status,
          lineCount: createOrderDto.orderItems.length,
        },
      });

      // Return the complete order with all relations
      return await this.orderRepository.findOne({
        where: { id: savedOrder.id },
        relations: [
          'customer',
          'orderItems',
          'orderItems.item',
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

  private parseOrderListQuery(raw: OrderListQueryInput): {
    applyOpts: {
      search?: string;
      includeOrderIdInSearch: boolean;
      statuses?: string[];
      dateFilter: ResolvedOrderDateFilter | null;
      orderItemNames: string[];
      customerId?: string;
      minGrandTotal?: number;
      maxGrandTotal?: number;
    };
    sortBy: OrderListSortField;
    sortOrder: 'ASC' | 'DESC';
  } {
    const DATE_FIELDS: OrderListDateField[] = ['orderDate', 'createdAt', 'deliveryDate'];
    let dateField: OrderListDateField = 'orderDate';
    if (raw.dateField?.trim()) {
      const df = raw.dateField.trim() as OrderListDateField;
      if (!DATE_FIELDS.includes(df)) {
        throw new BadRequestException(
          `Invalid dateField. Use one of: ${DATE_FIELDS.join(', ')}`,
        );
      }
      dateField = df;
    }

    let datePreset: OrderDatePreset | undefined;
    if (raw.datePreset?.trim()) {
      const normalized = raw.datePreset.trim().toLowerCase().replace(/-/g, '_');
      if (!isValidDatePreset(normalized)) {
        throw new BadRequestException(
          'Invalid datePreset. Use: today, this_week, this_month, last_week, last_month.',
        );
      }
      datePreset = normalized;
    }

    const SORT_FIELDS: OrderListSortField[] = ['createdAt', 'orderDate', 'deliveryDate', 'grandTotal'];
    let sortBy: OrderListSortField = 'createdAt';
    if (raw.sortBy?.trim()) {
      const sb = raw.sortBy.trim() as OrderListSortField;
      if (!SORT_FIELDS.includes(sb)) {
        throw new BadRequestException(`Invalid sortBy. Use one of: ${SORT_FIELDS.join(', ')}`);
      }
      sortBy = sb;
    }

    let sortOrder: 'ASC' | 'DESC' = 'DESC';
    if (raw.sortOrder?.trim()) {
      const so = raw.sortOrder.trim().toUpperCase();
      if (so !== 'ASC' && so !== 'DESC') {
        throw new BadRequestException('sortOrder must be ASC or DESC');
      }
      sortOrder = so as 'ASC' | 'DESC';
    }

    const statuses = parseStatusQuery(raw.status);
    const dateFilter = resolveOrderDateFilter({
      dateField,
      startDate: raw.startDate,
      endDate: raw.endDate,
      datePreset,
    });

    const orderItemNames = [raw.item1, raw.item2, raw.item3].filter(Boolean) as string[];

    let minGrandTotal: number | undefined;
    let maxGrandTotal: number | undefined;
    if (raw.minGrandTotal !== undefined && String(raw.minGrandTotal).trim() !== '') {
      const n = Number(raw.minGrandTotal);
      if (Number.isNaN(n)) {
        throw new BadRequestException('minGrandTotal must be a number');
      }
      minGrandTotal = n;
    }
    if (raw.maxGrandTotal !== undefined && String(raw.maxGrandTotal).trim() !== '') {
      const n = Number(raw.maxGrandTotal);
      if (Number.isNaN(n)) {
        throw new BadRequestException('maxGrandTotal must be a number');
      }
      maxGrandTotal = n;
    }

    return {
      applyOpts: {
        search: raw.search?.trim() || undefined,
        includeOrderIdInSearch: false,
        statuses,
        dateFilter,
        orderItemNames,
        customerId: raw.customerId?.trim() || undefined,
        minGrandTotal,
        maxGrandTotal,
      },
      sortBy,
      sortOrder,
    };
  }

  private applyOrderListFilters(
    queryBuilder: SelectQueryBuilder<Order>,
    opts: {
      search?: string;
      includeOrderIdInSearch: boolean;
      statuses?: string[];
      dateFilter: ResolvedOrderDateFilter | null;
      orderItemNames: string[];
      customerId?: string;
      minGrandTotal?: number;
      maxGrandTotal?: number;
    },
  ): void {
    let hasWhere = false;

    const searchSql = opts.includeOrderIdInSearch
      ? '(order.id::text LIKE :search OR order.series LIKE :search OR customer.fullName LIKE :search OR customer.phone LIKE :search OR orderItems.description LIKE :search OR paymentTransactions.reference LIKE :search OR commissionTransactions.reference LIKE :search OR salesPartner.fullName LIKE :search)'
      : '(order.series LIKE :search OR customer.fullName LIKE :search OR customer.phone LIKE :search OR orderItems.description LIKE :search OR paymentTransactions.reference LIKE :search OR commissionTransactions.reference LIKE :search OR salesPartner.fullName LIKE :search)';

    if (opts.search) {
      queryBuilder.where(searchSql, { search: `%${opts.search}%` });
      hasWhere = true;
    }

    if (opts.statuses?.length) {
      const clause = 'order.status IN (:...orderStatuses)';
      if (hasWhere) {
        queryBuilder.andWhere(clause, { orderStatuses: opts.statuses });
      } else {
        queryBuilder.where(clause, { orderStatuses: opts.statuses });
        hasWhere = true;
      }
    }

    if (opts.customerId) {
      const clause = 'order.customerId = :filterCustomerId';
      if (hasWhere) {
        queryBuilder.andWhere(clause, { filterCustomerId: opts.customerId });
      } else {
        queryBuilder.where(clause, { filterCustomerId: opts.customerId });
        hasWhere = true;
      }
    }

    if (opts.minGrandTotal !== undefined && Number.isFinite(opts.minGrandTotal)) {
      const clause = 'order.grandTotal >= :minGrandTotal';
      if (hasWhere) {
        queryBuilder.andWhere(clause, { minGrandTotal: opts.minGrandTotal });
      } else {
        queryBuilder.where(clause, { minGrandTotal: opts.minGrandTotal });
        hasWhere = true;
      }
    }

    if (opts.maxGrandTotal !== undefined && Number.isFinite(opts.maxGrandTotal)) {
      const clause = 'order.grandTotal <= :maxGrandTotal';
      if (hasWhere) {
        queryBuilder.andWhere(clause, { maxGrandTotal: opts.maxGrandTotal });
      } else {
        queryBuilder.where(clause, { maxGrandTotal: opts.maxGrandTotal });
        hasWhere = true;
      }
    }

    if (opts.dateFilter) {
      const { columnSql, start, end } = opts.dateFilter;
      if (start && end) {
        const clause = `${columnSql} BETWEEN :filterDateStart AND :filterDateEnd`;
        if (hasWhere) {
          queryBuilder.andWhere(clause, { filterDateStart: start, filterDateEnd: end });
        } else {
          queryBuilder.where(clause, { filterDateStart: start, filterDateEnd: end });
          hasWhere = true;
        }
      } else if (start) {
        const clause = `${columnSql} >= :filterDateStart`;
        if (hasWhere) {
          queryBuilder.andWhere(clause, { filterDateStart: start });
        } else {
          queryBuilder.where(clause, { filterDateStart: start });
          hasWhere = true;
        }
      } else if (end) {
        const clause = `${columnSql} <= :filterDateEnd`;
        if (hasWhere) {
          queryBuilder.andWhere(clause, { filterDateEnd: end });
        } else {
          queryBuilder.where(clause, { filterDateEnd: end });
          hasWhere = true;
        }
      }
    }

    if (opts.orderItemNames.length > 0) {
      const itemConditions = opts.orderItemNames
        .map((_, index) => `orderItemsItem.name LIKE :listItem${index}`)
        .join(' OR ');
      if (hasWhere) {
        queryBuilder.andWhere(`(${itemConditions})`);
      } else {
        queryBuilder.where(`(${itemConditions})`);
        hasWhere = true;
      }
      opts.orderItemNames.forEach((name, index) => {
        queryBuilder.setParameter(`listItem${index}`, `%${name}%`);
      });
    }
  }

  async findAll(skip: number, take: number, query: OrderListQueryInput = {}) {
    const { applyOpts, sortBy, sortOrder } = this.parseOrderListQuery(query);

    const sortColumnMap: Record<OrderListSortField, string> = {
      createdAt: 'order.createdAt',
      orderDate: 'order.orderDate',
      deliveryDate: 'order.deliveryDate',
      grandTotal: 'order.grandTotal',
    };

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
      .orderBy(sortColumnMap[sortBy], sortOrder)
      .skip(Number(skip))
      .take(Number(take));

    this.applyOrderListFilters(queryBuilder, applyOpts);

    const [orders, total] = await queryBuilder.getManyAndCount();

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

    this.applyOrderListFilters(grandTotalQuery, applyOpts);

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

  async update(id: string, updateOrderDto: UpdateOrderDto, user: User) {
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

    // Industry standard: delivered orders are posted and immutable
    if (existingOrder.status === 'Delivered') {
      throw new ConflictException(
        'Delivered orders cannot be modified. Create a remake/replacement or a return/adjustment instead.',
      );
    }

    if (orderData.adminApproval !== undefined) {
      const next = Boolean(orderData.adminApproval);
      const prev = Boolean(existingOrder.adminApproval);
      if (next !== prev) {
        await assertCanManageApprovals(
          this.permissionsService,
          user,
          'Order admin approval',
        );
      }
    }

    for (const item of orderItems) {
      if (item.id) {
        const prevLine = existingOrder.orderItems.find((oi) => oi.id === item.id);
        if (prevLine) {
          if (
            item.approvalStatus !== undefined &&
            item.approvalStatus !== prevLine.approvalStatus &&
            (isApprovedLabel(item.approvalStatus) ||
              isApprovedLabel(prevLine.approvalStatus))
          ) {
            await assertCanManageApprovals(
              this.permissionsService,
              user,
              'Order line approval (order update)',
            );
          }
          if (
            item.adminApproval !== undefined &&
            item.adminApproval !== prevLine.adminApproval
          ) {
            await assertCanManageApprovals(
              this.permissionsService,
              user,
              'Order line admin flag (order update)',
            );
          }
        }
      } else {
        if (
          isApprovedLabel(item.approvalStatus) ||
          item.adminApproval === true
        ) {
          await assertCanManageApprovals(
            this.permissionsService,
            user,
            'New order line with approval on order update',
          );
        }
      }
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

    const paymentTermForOrder = Array.isArray(existingOrder.paymentTerm)
      ? existingOrder.paymentTerm[0]
      : existingOrder.paymentTerm;

    if (
      paymentTermForOrder?.forcePayment &&
      (Number(paymentTermForOrder.totalAmount) <= 0 || Number(paymentTermForOrder.remainingAmount) > 0)
    ) {
      const orderApproving =
        orderData.adminApproval === true && existingOrder.adminApproval !== true;
      const anyLineApproving = orderItems.some(item => {
        if (item.approvalStatus !== 'Approved') return false;
        const prev = existingOrder.orderItems.find(oi => oi.id === item.id);
        return !prev || prev.approvalStatus !== 'Approved';
      });
      if (orderApproving || anyLineApproving) {
        throw new ConflictException(
          `Cannot approve: force payment is active for this order and payment is not complete (remaining ${paymentTermForOrder.remainingAmount}).`,
        );
      }
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
        grandTotal: parseFloat((orderData.grandTotal || 0).toString()),
        totalQuantity: parseFloat((orderData.totalQuantity || 0).toString()),
        internalNote: orderData.internalNote,
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
        const hasPerEye = item.quantityRight !== undefined || item.quantityLeft !== undefined;
        const quantityRight = hasPerEye ? parseFloat((item.quantityRight ?? 0).toString()) : parseFloat((item.quantity || 0).toString());
        const quantityLeft = hasPerEye ? parseFloat((item.quantityLeft ?? 0).toString()) : 0;
        const quantity = quantityRight + quantityLeft;

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

        // Normalize empty strings to null for UUID columns (Postgres rejects "" as UUID)
        const norm = (v: string | null | undefined) => (v && String(v).trim() !== '' ? v : null);
        const serviceIdVal = isNonStockService ? null : norm(item.serviceId);
        const nonStockServiceIdVal = isNonStockService ? norm(item.nonStockServiceId) : null;

        // Use calculated sales when payload sends 0 so item/order totals stay correct
        const payloadTotal = parseFloat((item.totalAmount || 0).toString());
        const payloadUnitPrice = parseFloat((item.unitPrice || 0).toString());
        const totalAmountToUse = payloadTotal > 0 ? payloadTotal : (salesResult.sales ?? 0);
        const unitPriceToUse = payloadUnitPrice > 0 ? payloadUnitPrice : (quantity > 0 ? totalAmountToUse / quantity : 0);

        if (item.id) {
          const prevLine = existingOrder.orderItems.find(oi => oi.id === item.id);
          if (prevLine) {
            const lineInProduction = ['InProgress', 'Ready'].includes(prevLine.status);
            const lineApproved = prevLine.approvalStatus === 'Approved';
            const orderInProduction = ['InProgress', 'Ready'].includes(existingOrder.status);
            if (lineInProduction || lineApproved || orderInProduction) {
              assertWorkflowOnlyOrderItemPayload(item as unknown as Record<string, unknown>, prevLine);
            }
          }
          // Update existing order item
          await queryRunner.manager.update(OrderItems, item.id, {
            itemId: item.itemId,
            itemBaseId: norm(item.itemBaseId),
            serviceId: serviceIdVal,
            nonStockServiceId: nonStockServiceIdVal,
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
            totalAmount: totalAmountToUse,
            adminApproval: item.adminApproval || false,
            uomId: item.uomId,
            quantity,
            quantityRight,
            quantityLeft,
            unitPrice: unitPriceToUse,
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
            itemBaseId: norm(item.itemBaseId),
            serviceId: serviceIdVal,
            nonStockServiceId: nonStockServiceIdVal,
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
            totalAmount: totalAmountToUse,
            adminApproval: item.adminApproval || false,
            uomId: item.uomId,
            quantity,
            quantityRight,
            quantityLeft,
            unitPrice: unitPriceToUse,
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

      // Recalculate order totals from current order items (same as create flow)
      const currentItems = await queryRunner.manager.find(OrderItems, { where: { orderId: id } });
      const recalculatedTotalAmount = currentItems.reduce((sum, oi) => sum + (oi.totalAmount || 0), 0);
      const recalculatedTotalQuantity = currentItems.reduce((sum, oi) => sum + (oi.quantity || 0), 0);
      const recalculatedGrandTotal = recalculatedTotalAmount;
      await queryRunner.manager.update(Order, id, {
        totalAmount: recalculatedTotalAmount,
        totalQuantity: recalculatedTotalQuantity,
        grandTotal: recalculatedGrandTotal,
      });

      // Ensure required lab tools (based on Rx + base) exist before order can be produced
      await this.ensureLabToolsAvailableForOrderItems(currentItems);

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

      const changes: string[] = [];
      if (
        orderData.status !== undefined &&
        orderData.status !== existingOrder.status
      ) {
        changes.push(`Order status: ${existingOrder.status} → ${orderData.status}`);
      }
      if (
        orderData.adminApproval !== undefined &&
        Boolean(orderData.adminApproval) !== Boolean(existingOrder.adminApproval)
      ) {
        changes.push(
          `Order admin approval: ${existingOrder.adminApproval} → ${orderData.adminApproval}`,
        );
      }
      for (const item of orderItems) {
        if (!item.id) {
          changes.push(`New order line (item ${item.itemId})`);
          continue;
        }
        const prevLine = existingOrder.orderItems.find((oi) => oi.id === item.id);
        if (!prevLine) continue;
        if (item.status !== undefined && item.status !== prevLine.status) {
          changes.push(`Line ${item.id} status: ${prevLine.status} → ${item.status}`);
        }
        if (
          item.approvalStatus !== undefined &&
          item.approvalStatus !== prevLine.approvalStatus
        ) {
          changes.push(
            `Line ${item.id} approval: ${prevLine.approvalStatus} → ${item.approvalStatus}`,
          );
        }
        if (
          item.qualityControlStatus !== undefined &&
          item.qualityControlStatus !== prevLine.qualityControlStatus
        ) {
          changes.push(
            `Line ${item.id} QC: ${prevLine.qualityControlStatus} → ${item.qualityControlStatus}`,
          );
        }
        if (
          item.storeRequestStatus !== undefined &&
          item.storeRequestStatus !== prevLine.storeRequestStatus
        ) {
          changes.push(
            `Line ${item.id} store: ${prevLine.storeRequestStatus} → ${item.storeRequestStatus}`,
          );
        }
      }
      if (orderItemsToDelete.length > 0) {
        changes.push(`${orderItemsToDelete.length} order line(s) removed`);
      }
      if (changes.length > 0) {
        await this.notificationsService.notifyAllActiveUsers({
          type: 'ORDER',
          title: `Order ${existingOrder.series} updated`,
          message: changes.join('\n'),
          data: {
            orderId: id,
            series: existingOrder.series,
            changes,
          },
        });
      }

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

      if (error instanceof HttpException) {
        throw error;
      }
      if (error?.code === 'ER_DUP_ENTRY') {
        throw new ConflictException('Database constraint violation occurred. Please check your data.');
      }

      console.error('Error updating order:', error);
      throw new BadRequestException(error?.message || 'Failed to update order');
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

      // Check if all order items are still Pending (not yet in production)
      if (order.orderItems && order.orderItems.length > 0) {
        const nonPendingItems = order.orderItems.filter(item => item.status !== 'Pending');
        if (nonPendingItems.length > 0) {
          throw new ConflictException(
            `Cannot delete order. Order items with IDs [${nonPendingItems.map(item => item.id).join(', ')}] are not in "Pending" status. Order is already in process.`
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

    const { unit, baseUomId } = await this.calculateUnitForQuantity(itemId, serviceId, uomId, quantity);

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

    const { unit, baseUomId } = await this.calculateUnitForQuantity(itemId, serviceId, uomId, quantity);

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
          quantityRight: orderItem.quantityRight ?? 0,
          quantityLeft: orderItem.quantityLeft ?? 0,
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
