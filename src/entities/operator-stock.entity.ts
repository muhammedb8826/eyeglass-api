import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Item } from './item.entity';
import { UOM } from './uom.entity';

@Entity('operator_stock')
export class OperatorStock {
  @PrimaryGeneratedColumn('uuid')
  id: string;

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