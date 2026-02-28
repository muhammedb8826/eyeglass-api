import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Item } from './item.entity';
import { UOM } from './uom.entity';

export type BincardMovementType = 'IN' | 'OUT';
export type BincardReferenceType =
  | 'OPENING'
  | 'ORDER'
  | 'SALE'
  | 'PURCHASE'
  | 'ADJUSTMENT';

@Entity('bincard')
export class Bincard {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  itemId: string;

  @Column({ type: 'varchar', length: 3 })
  movementType: BincardMovementType;

  @Column('float')
  quantity: number;

  @Column('float')
  balanceAfter: number;

  @Column({ type: 'varchar', length: 20 })
  referenceType: BincardReferenceType;

  @Column({ nullable: true })
  referenceId: string;

  @Column({ nullable: true })
  description: string;

  @Column()
  uomId: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Item, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'itemId' })
  item: Item;

  @ManyToOne(() => UOM, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'uomId' })
  uom: UOM;
}
