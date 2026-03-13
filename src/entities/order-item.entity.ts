import { Entity, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany, BeforeInsert, PrimaryColumn } from 'typeorm';
import { Item } from './item.entity';
import { ItemBase } from './item-base.entity';
import { Order } from './order.entity';
import { Pricing } from './pricing.entity';
import { UOM } from './uom.entity';
import { Service } from './service.entity';
import { NonStockService } from './non-stock-service.entity';
import { OrderItemNotes } from './order-item-notes.entity';
import { randomUUID } from 'crypto';

@Entity('order_items')
export class OrderItems {
  @PrimaryColumn('uuid')
  id: string;

  @BeforeInsert()
  setId() {
    if (!this.id) {
      this.id = randomUUID();
    }
  }

  @Column()
  orderId: string;

  @Column()
  itemId: string;

  /** When material has bases (e.g. 3221 with 350^+25, 575^+25), which variant was chosen */
  @Column({ nullable: true })
  itemBaseId: string;

  @Column({ nullable: true })
  serviceId: string;

  @Column({ nullable: true })
  nonStockServiceId: string;

  @Column({ default: false })
  isNonStockService: boolean;

  // Eyeglass lens prescription (per-eye) and common lens parameters
  @Column('float', { nullable: true })
  sphereRight: number;

  @Column('float', { nullable: true })
  sphereLeft: number;

  @Column('float', { nullable: true })
  cylinderRight: number;

  @Column('float', { nullable: true })
  cylinderLeft: number;

  @Column('float', { nullable: true })
  axisRight: number;

  @Column('float', { nullable: true })
  axisLeft: number;

  @Column('float', { nullable: true })
  prismRight: number;

  @Column('float', { nullable: true })
  prismLeft: number;

  @Column('float', { nullable: true })
  addRight: number;

  @Column('float', { nullable: true })
  addLeft: number;

  @Column('float', { nullable: true })
  pd: number;

  @Column('float', { nullable: true })
  pdMonocularRight: number;

  @Column('float', { nullable: true })
  pdMonocularLeft: number;

  @Column({ nullable: true })
  lensType: string;

  @Column({ nullable: true })
  lensMaterial: string;

  @Column({ nullable: true })
  lensCoating: string;

  @Column('float', { nullable: true })
  lensIndex: number;

  @Column('float', { nullable: true })
  baseCurve: number;

  @Column('float', { nullable: true })
  diameter: number;

  @Column({ nullable: true })
  tintColor: string;

  @Column('float', { nullable: true })
  discount: number;

  @Column()
  level: number;

  @Column('float')
  totalAmount: number;

  @Column()
  adminApproval: boolean;

  /** Per-item approval status (e.g. Approved) */
  @Column({ default: 'Pending' })
  approvalStatus: string;

  /** Per-item quality control status (Pending, Passed, Failed) */
  @Column({ default: 'Pending' })
  qualityControlStatus: string;

  /** Store request/issue status for this line (e.g. None, Requested, Issued) */
  @Column({ default: 'None' })
  storeRequestStatus: string;

  @Column()
  uomId: string;

  /** Total quantity (quantityRight + quantityLeft). Kept for backward compat and order totals. */
  @Column()
  quantity: number;

  /** Quantity for right lens (per prescription). Right and left can be produced separately. */
  @Column('float', { default: 0 })
  quantityRight: number;

  /** Quantity for left lens (per prescription). Right and left can be produced separately. */
  @Column('float', { default: 0 })
  quantityLeft: number;

  @Column('float')
  unitPrice: number;

  @Column({ nullable: true })
  description: string;

  @Column()
  status: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column()
  isDiscounted: boolean;

  @Column()
  pricingId: string;

  @Column()
  baseUomId: string;

  @Column('float')
  unit: number;

  @Column('float', { default: 0 })
  totalCost: number;

  @Column('float', { default: 0 })
  sales: number;

  @OneToMany(() => OrderItemNotes, orderItemNotes => orderItemNotes.orderItem)
  orderItemNotes: OrderItemNotes[];

  @ManyToOne(() => Item, item => item.OrderItems)
  @JoinColumn({ name: 'itemId' })
  item: Item;

  @ManyToOne(() => ItemBase, itemBase => itemBase.orderItems)
  @JoinColumn({ name: 'itemBaseId' })
  itemBase: ItemBase;

  @ManyToOne(() => Order, order => order.orderItems)
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @ManyToOne(() => Pricing, pricing => pricing.orderItems)
  @JoinColumn({ name: 'pricingId' })
  pricing: Pricing;

  @ManyToOne(() => UOM, uom => uom.orderItems)
  @JoinColumn({ name: 'uomId', foreignKeyConstraintName: 'FK_9de9472d1a87fd106634222c1b8' })
  uom: UOM;

  @ManyToOne(() => UOM, baseUom => baseUom.baseOrderItems)
  @JoinColumn({ name: 'baseUomId', foreignKeyConstraintName: 'FK_11690dede7681c3c9ec1fd62d08' })
  baseUom: UOM;

  @ManyToOne(() => Service, service => service.orderItems)
  @JoinColumn({ name: 'serviceId' })
  service: Service;

  @ManyToOne(() => NonStockService, nonStockService => nonStockService.orderItems)
  @JoinColumn({ name: 'nonStockServiceId' })
  nonStockService: NonStockService;
}