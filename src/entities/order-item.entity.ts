import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Item } from './item.entity';
import { Order } from './order.entity';
import { Pricing } from './pricing.entity';
import { UOM } from './uom.entity';
import { Service } from './service.entity';
import { NonStockService } from './non-stock-service.entity';
import { OrderItemNotes } from './order-item-notes.entity';

@Entity('order_items')
export class OrderItems {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  orderId: string;

  @Column()
  itemId: string;

  @Column({ nullable: true })
  serviceId: string;

  @Column({ nullable: true })
  nonStockServiceId: string;

  @Column({ default: false })
  isNonStockService: boolean;

  @Column('float', { nullable: true })
  width: number;

  @Column('float', { nullable: true })
  height: number;

  @Column('float', { nullable: true })
  discount: number;

  @Column()
  level: number;

  @Column('float')
  totalAmount: number;

  @Column()
  adminApproval: boolean;

  @Column()
  uomId: string;

  @Column()
  quantity: number;

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

  @ManyToOne(() => Order, order => order.orderItems)
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @ManyToOne(() => Pricing, pricing => pricing.orderItems)
  @JoinColumn({ name: 'pricingId' })
  pricing: Pricing;

  @ManyToOne(() => UOM, uom => uom.orderItems)
  @JoinColumn({ name: 'uomId' })
  uom: UOM;

  @ManyToOne(() => UOM, baseUom => baseUom.baseOrderItems)
  @JoinColumn({ name: 'baseUomId' })
  baseUom: UOM;

  @ManyToOne(() => Service, service => service.orderItems)
  @JoinColumn({ name: 'serviceId' })
  service: Service;

  @ManyToOne(() => NonStockService, nonStockService => nonStockService.orderItems)
  @JoinColumn({ name: 'nonStockServiceId' })
  nonStockService: NonStockService;
}