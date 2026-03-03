import { Entity, Column, OneToMany, CreateDateColumn, UpdateDateColumn, ManyToMany, JoinTable, BeforeInsert, PrimaryColumn } from 'typeorm';
import { Pricing } from './pricing.entity';
import { OrderItems } from './order-item.entity';
import { Item } from './item.entity';
import { randomUUID } from 'crypto';

@Entity('services')
export class Service {
  @PrimaryColumn('uuid')
  id: string;

  @BeforeInsert()
  setId() {
    if (!this.id) {
      this.id = randomUUID();
    }
  }

  @Column({ unique: true })
  name: string;

  @Column({ default: true })
  status: boolean;

  @Column({ nullable: true })
  description: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Pricing, pricing => pricing.service)
  pricing: Pricing[];

  @ManyToMany(() => Item, item => item.services)
  @JoinTable()
  items: Item[];

  @OneToMany(() => OrderItems, orderItems => orderItems.service)
  orderItems: OrderItems[];
}