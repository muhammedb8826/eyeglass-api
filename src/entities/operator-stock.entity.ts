import { Entity, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, BeforeInsert, PrimaryColumn } from 'typeorm';
import { Item } from './item.entity';
import { UOM } from './uom.entity';
import { randomUUID } from 'crypto';

@Entity('operator_stock')
export class OperatorStock {
  @PrimaryColumn('uuid')
  id: string;

  @BeforeInsert()
  setId() {
    if (!this.id) {
      this.id = randomUUID();
    }
  }

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

  @ManyToOne(() => Item, item => item.operatorStock)
  @JoinColumn({ name: 'itemId' })
  item: Item;

  @ManyToOne(() => UOM, uom => uom.operatorStock)
  @JoinColumn({ name: 'uomId' })
  uoms: UOM;
}