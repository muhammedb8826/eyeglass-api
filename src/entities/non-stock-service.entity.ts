import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Pricing } from './pricing.entity';
import { OrderItems } from './order-item.entity';

@Entity('non_stock_services')
export class NonStockService {
  @PrimaryGeneratedColumn('uuid')
  id: string;

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