import { Entity, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany, Unique, BeforeInsert, PrimaryColumn } from 'typeorm';
import { Item } from './item.entity';
import { Purchase } from './purchase.entity';
import { UOM } from './uom.entity';
import { PurchaseItemNote } from './purchase-item-note.entity';
import { randomUUID } from 'crypto';

@Entity('purchase_items')
@Unique(['purchaseId', 'itemId'])
export class PurchaseItems {
  @PrimaryColumn('uuid')
  id: string;

  @BeforeInsert()
  setId() {
    if (!this.id) {
      this.id = randomUUID();
    }
  }

  @Column()
  purchaseId: string;

  @Column()
  itemId: string;

  @Column()
  quantity: number;

  @Column('float')
  unitPrice: number;

  @Column('float')
  amount: number;

  @Column({ nullable: true })
  description: string;

  @Column()
  status: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column()
  uomId: string;

  @Column()
  baseUomId: string;

  @Column('float')
  unit: number;

  @OneToMany(() => PurchaseItemNote, purchaseItemNote => purchaseItemNote.purchaseItem)
  purchaseItemNotes: PurchaseItemNote[];

  @ManyToOne(() => Item, item => item.purchases)
  @JoinColumn({ name: 'itemId' })
  item: Item;

  @ManyToOne(() => Purchase, purchase => purchase.purchaseItems)
  @JoinColumn({ name: 'purchaseId' })
  purchase: Purchase;

  @ManyToOne(() => UOM, uom => uom.purchaseItems)
  @JoinColumn({ name: 'uomId' })
  uoms: UOM;
}