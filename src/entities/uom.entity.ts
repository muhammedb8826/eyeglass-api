import { Entity, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany, Unique, BeforeInsert, PrimaryColumn } from 'typeorm';
import { UnitCategory } from './unit-category.entity';
import { OperatorStock } from './operator-stock.entity';
import { OrderItems } from './order-item.entity';
import { Pricing } from './pricing.entity';
import { PurchaseItems } from './purchase-item.entity';
import { SaleItems } from './sale-item.entity';
import { Item } from './item.entity';
import { randomUUID } from 'crypto';

@Entity('uom')
@Unique(['name', 'abbreviation', 'unitCategoryId'])
export class UOM {
  @PrimaryColumn('uuid')
  id: string;

  @BeforeInsert()
  setId() {
    if (!this.id) {
      this.id = randomUUID();
    }
  }

  @Column()
  name: string;

  @Column()
  abbreviation: string;

  @Column('float')
  conversionRate: number;

  @Column({ default: false })
  baseUnit: boolean;

  @Column()
  unitCategoryId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => OperatorStock, operatorStock => operatorStock.uoms)
  operatorStock: OperatorStock[];

  @OneToMany(() => OrderItems, orderItems => orderItems.uom)
  orderItems: OrderItems[];

  @OneToMany(() => OrderItems, baseOrderItems => baseOrderItems.baseUom)
  baseOrderItems: OrderItems[];

  @OneToMany(() => Pricing, pricing => pricing.uom)
  pricing: Pricing[];

  @OneToMany(() => PurchaseItems, purchaseItems => purchaseItems.uoms)
  purchaseItems: PurchaseItems[];

  @OneToMany(() => SaleItems, saleItems => saleItems.uoms)
  saleItems: SaleItems[];

  @ManyToOne(() => UnitCategory, unitCategory => unitCategory.uoms)
  @JoinColumn({ name: 'unitCategoryId' })
  unitCategory: UnitCategory;

  @OneToMany(() => Item, item => item.defaultUom)
  defaultUom: Item[];

  @OneToMany(() => Item, item => item.purchaseUom)
  purchaseUom: Item[];
}