import { Entity, Column, CreateDateColumn, UpdateDateColumn, OneToMany, BeforeInsert, PrimaryColumn } from 'typeorm';
import { Order } from './order.entity';
import { randomUUID } from 'crypto';

@Entity('customers')
export class Customer {
  @PrimaryColumn('uuid')
  id: string;

  @BeforeInsert()
  setId() {
    if (!this.id) {
      this.id = randomUUID();
    }
  }

  @Column()
  fullName: string;

  @Column({ nullable: true })
  email: string;

  @Column({ unique: true })
  phone: string;

  @Column({ nullable: true })
  company: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  description: string;

  // Patient-specific fields for eyeglass orders
  @Column({ type: 'date', nullable: true })
  dateOfBirth: Date;

  @Column({ nullable: true })
  gender: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Order, order => order.customer)
  orders: Order[];
}