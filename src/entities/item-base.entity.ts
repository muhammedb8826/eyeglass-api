import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, CreateDateColumn, UpdateDateColumn, JoinColumn, Unique } from 'typeorm';
import { Item } from './item.entity';
import { OrderItems } from './order-item.entity';
import { Pricing } from './pricing.entity';

/**
 * One item code (material) can have multiple bases, each with an add power.
 * e.g. 3221(350^+25, 575^+25) → two bases: 350 @ +2.5, 575 @ +2.5
 *      1311(400^+25, 600^+25, 800^+75, 1000^+75) → four bases
 * baseCode: the base value (350, 575, 400, 600, 800, 1000)
 * addPower: add power in diopters (2.5 for +25, 7.5 for +75)
 */
@Entity('item_bases')
@Unique(['itemId', 'baseCode', 'addPower'])
export class ItemBase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  itemId: string;

  /** Base code from supplier (e.g. 350, 575, 400, 600, 800, 1000) */
  @Column()
  baseCode: string;

  /** Add power in diopters (e.g. 2.5, 7.5) */
  @Column('float')
  addPower: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Item, item => item.itemBases)
  @JoinColumn({ name: 'itemId' })
  item: Item;

  @OneToMany(() => OrderItems, orderItem => orderItem.itemBase)
  orderItems: OrderItems[];

  @OneToMany(() => Pricing, pricing => pricing.itemBase)
  pricing: Pricing[];
}
