import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Item } from './item.entity';
import { ItemBase } from './item-base.entity';
import { Service } from './service.entity';
import { NonStockService } from './non-stock-service.entity';
import { UOM } from './uom.entity';
import { OrderItems } from './order-item.entity';

@Entity('pricing')
export class Pricing {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  itemId: string;

  /** Optional: price can be per item base variant (e.g. 3221-350-+2.5) */
  @Column({ nullable: true })
  itemBaseId: string;

  @Column({ nullable: true })
  serviceId: string;

  @Column({ nullable: true })
  nonStockServiceId: string;

  @Column({ default: false })
  isNonStockService: boolean;

  @Column('float')
  sellingPrice: number;

  @Column('float')
  costPrice: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ default: false })
  constant: boolean;

  @Column('float', { nullable: true })
  height: number;

  @Column('float', { nullable: true })
  width: number;

  @Column()
  baseUomId: string;

  @ManyToOne(() => UOM, uom => uom.pricing)
  @JoinColumn({ name: 'baseUomId' })
  uom: UOM;

  @ManyToOne(() => Item, item => item.pricing)
  @JoinColumn({ name: 'itemId' })
  item: Item;

  @ManyToOne(() => ItemBase, itemBase => itemBase.pricing)
  @JoinColumn({ name: 'itemBaseId' })
  itemBase: ItemBase;

  @ManyToOne(() => Service, service => service.pricing)
  @JoinColumn({ name: 'serviceId' })
  service: Service;

  @ManyToOne(() => NonStockService, nonStockService => nonStockService.pricing)
  @JoinColumn({ name: 'nonStockServiceId' })
  nonStockService: NonStockService;

  @OneToMany(() => OrderItems, orderItems => orderItems.pricing)
  orderItems: OrderItems[];
}