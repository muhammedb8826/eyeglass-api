import { Entity, Column, CreateDateColumn, UpdateDateColumn, OneToOne, JoinColumn, OneToMany, BeforeInsert, PrimaryColumn } from 'typeorm';
import { Order } from './order.entity';
import { PaymentTransaction } from './payment-transaction.entity';
import { randomUUID } from 'crypto';

@Entity('payment_terms')
export class PaymentTerm {
  @PrimaryColumn('uuid')
  id: string;

  @BeforeInsert()
  setId() {
    if (!this.id) {
      this.id = randomUUID();
    }
  }

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