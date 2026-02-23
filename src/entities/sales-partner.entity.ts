import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Commission } from './commission.entity';
import { Order } from './order.entity';

@Entity('sales_partners')
export class SalesPartner {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  fullName: string;

  @Column({ unique: true, nullable: true })
  email: string;

  @Column({ unique: true })
  phone: string;

  @Column({ nullable: true })
  company: string;

  @Column()
  address: string;

  @Column({ nullable: true })
  description: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Commission, commission => commission.salesPartner)
  commissions: Commission[];

  @OneToMany(() => Order, order => order.salesPartner)
  orders: Order[];
}