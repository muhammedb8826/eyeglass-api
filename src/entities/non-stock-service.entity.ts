import { Entity, Column, OneToMany, CreateDateColumn, UpdateDateColumn, BeforeInsert, PrimaryColumn } from 'typeorm';
import { Pricing } from './pricing.entity';
import { OrderItems } from './order-item.entity';
import { randomUUID } from 'crypto';

@Entity('non_stock_services')
export class NonStockService {
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

  @OneToMany(() => Pricing, pricing => pricing.nonStockService)
  pricing: Pricing[];



  @OneToMany(() => OrderItems, orderItems => orderItems.nonStockService)
  orderItems: OrderItems[];
}