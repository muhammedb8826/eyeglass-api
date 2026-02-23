import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { Item } from './item.entity';

@Entity('discounts')
@Unique(['itemId', 'level'])
export class Discount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  level: number;

  @Column()
  itemId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column('float')
  percentage: number;

  @Column('float')
  unit: number;

  @Column({ nullable: true })
  description: string;

  @ManyToOne(() => Item, item => item.discounts)
  @JoinColumn({ name: 'itemId' })
  items: Item;
}