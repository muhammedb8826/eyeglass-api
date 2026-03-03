import { Entity, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Unique, BeforeInsert, PrimaryColumn } from 'typeorm';
import { Item } from './item.entity';
import { randomUUID } from 'crypto';

@Entity('discounts')
@Unique(['itemId', 'level'])
export class Discount {
  @PrimaryColumn('uuid')
  id: string;

  @BeforeInsert()
  setId() {
    if (!this.id) {
      this.id = randomUUID();
    }
  }

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