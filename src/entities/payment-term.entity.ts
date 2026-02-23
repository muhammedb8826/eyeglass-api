import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToOne, JoinColumn, OneToMany } from 'typeorm';
import { Order } from './order.entity';
import { PaymentTransaction } from './payment-transaction.entity';

@Entity('payment_terms')
export class PaymentTerm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  orderId: string;

  @Column('float')
  totalAmount: number;

  @Column('float')
  remainingAmount: number;

  @Column()
  status: string;

  @Column()
  forcePayment: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToOne(() => Order, order => order.paymentTerm, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @OneToMany(() => PaymentTransaction, transaction => transaction.paymentTerm, { onDelete: 'CASCADE' })
  transactions: PaymentTransaction[];
}