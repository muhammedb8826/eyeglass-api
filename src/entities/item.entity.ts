import { Entity, Column, ManyToOne, OneToMany, CreateDateColumn, UpdateDateColumn, JoinTable, JoinColumn, ManyToMany, BeforeInsert, PrimaryColumn } from 'typeorm';
import { UOM } from './uom.entity';
import { UnitCategory } from './unit-category.entity';
import { Attribute } from './attribute.entity';
import { ItemBase } from './item-base.entity';
import { OrderItems } from './order-item.entity';
import { Pricing } from './pricing.entity';
import { PurchaseItems } from './purchase-item.entity';
import { SaleItems } from './sale-item.entity';
import { Discount } from './discount.entity';
import { Service } from './service.entity';
import { randomUUID } from 'crypto';

@Entity('items')
export class Item {
  @PrimaryColumn('uuid')
  id: string;

  @BeforeInsert()
  setId() {
    if (!this.id) {
      this.id = randomUUID();
    }
  }

  @Column({ nullable: true, unique: true })
  itemCode: string;

  @Column({ unique: true })
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column()
  reorder_level: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ default: true })
  can_be_purchased: boolean;

  @Column({ default: true })
  can_be_sold: boolean;

  @Column()
  quantity: number;

  @Column({ nullable: true })
  unitCategoryId: string;

  @Column({ nullable: true })
  defaultUomId: string;

  @Column({ nullable: true })
  purchaseUomId: string;

  @OneToMany(() => Attribute, attribute => attribute.items)
  attributes: Attribute[];

  @OneToMany(() => ItemBase, itemBase => itemBase.item)
  itemBases: ItemBase[];

  @OneToMany(() => OrderItems, orderItems => orderItems.item)
  OrderItems: OrderItems[];

  @OneToMany(() => Pricing, pricing => pricing.item)
  pricing: Pricing[];

  @OneToMany(() => PurchaseItems, purchaseItems => purchaseItems.item)
  purchases: PurchaseItems[];

  @OneToMany(() => SaleItems, saleItems => saleItems.item)
  sales: SaleItems[];

  @OneToMany(() => Discount, discount => discount.items)
  discounts: Discount[];

  @ManyToOne(() => UOM, uom => uom.defaultUom)
  @JoinColumn({ name: 'defaultUomId' })
  defaultUom: UOM;

  @ManyToOne(() => UOM, uom => uom.purchaseUom)
  @JoinColumn({ name: 'purchaseUomId' })
  purchaseUom: UOM;

  @ManyToOne(() => UnitCategory, unitCategory => unitCategory.items)
  @JoinColumn({ name: 'unitCategoryId' })
  unitCategory: UnitCategory;

  @ManyToMany(() => Service, service => service.items)
  @JoinTable()
  services: Service[];
}