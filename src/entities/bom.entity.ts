import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  BeforeInsert,
  PrimaryColumn,
} from 'typeorm';
import { randomUUID } from 'crypto';
import { Item } from './item.entity';
import { UOM } from './uom.entity';

@Entity('bom')
export class Bom {
  @PrimaryColumn('uuid')
  id: string;

  @BeforeInsert()
  setId() {
    if (!this.id) {
      this.id = randomUUID();
    }
  }

  /** Finished good / lens item that uses this BOM. */
  @Column()
  parentItemId: string;

  /** Component item that must be requested from inventory. */
  @Column()
  componentItemId: string;

  /** Quantity of component (in the given UOM) needed per 1 unit of parent item. */
  @Column('float')
  quantity: number;

  /** UOM for the component quantity (e.g. pcs). */
  @Column()
  uomId: string;

  @ManyToOne(() => Item, item => item.bomLines)
  @JoinColumn({ name: 'parentItemId' })
  parentItem: Item;

  @ManyToOne(() => Item)
  @JoinColumn({ name: 'componentItemId' })
  componentItem: Item;

  @ManyToOne(() => UOM)
  @JoinColumn({ name: 'uomId' })
  uom: UOM;
}

