import { Entity, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany, PrimaryColumn, BeforeInsert } from 'typeorm';
import { Item } from './item.entity';
import { Sale } from './sale.entity';
import { UOM } from './uom.entity';
import { SalesItemNote } from './sales-item-note.entity';
import { randomUUID } from 'crypto';

@Entity('sale_items')
export class SaleItems {
  @PrimaryColumn('uuid')
  id: string;

  @BeforeInsert()
  setId() {
    if (!this.id) {
      this.id = randomUUID();
    }
  }

  @Column()
  saleId: string;

  @Column()
  itemId: string;

  @Column()
  quantity: number;

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

  @ManyToOne(() => Item, item => item.sales)
  @JoinColumn({ name: 'itemId' })
  item: Item;

  @ManyToOne(() => Sale, sale => sale.saleItems)
  @JoinColumn({ name: 'saleId' })
  sale: Sale;

  @ManyToOne(() => UOM, uom => uom.saleItems)
  @JoinColumn({ name: 'uomId' })
  uoms: UOM;

  @OneToMany(() => SalesItemNote, salesItemNote => salesItemNote.saleItem)
  saleItemNotes: SalesItemNote[];
}