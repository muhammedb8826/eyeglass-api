import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Customer } from './customer.entity';
import { SalesPartner } from './sales-partner.entity';
import { PaymentTerm } from './payment-term.entity';
import { Commission } from './commission.entity';
import { OrderItems } from './order-item.entity';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  series: string;

  @Column()
  customerId: string;

  @Column()
  status: string;

  @CreateDateColumn()
  orderDate: Date;

  @Column()
  deliveryDate: Date;

  @Column('float')
  totalAmount: number;

  @Column('float')
  tax: number;

  @Column('float')
  grandTotal: number;

  @Column()
  totalQuantity: number;

  @Column({ nullable: true })
  internalNote: string;

  @Column({ nullable: true })
  paymentTermId: string;

  @Column({ nullable: true })
  commissionId: string;

  @Column('simple-array')
  fileNames: string[];

  @Column()
  adminApproval: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  salesPartnersId: string;

  @Column()
  orderSource: string;

  @OneToMany(() => OrderItems, orderItems => orderItems.order)
  orderItems: OrderItems[];

  @OneToMany(() => Commission, commission => commission.order)
  commission: Commission[];

  @ManyToOne(() => Customer, customer => customer.orders)
  @JoinColumn({ name: 'customerId' })
  customer: Customer;

  @ManyToOne(() => SalesPartner, salesPartner => salesPartner.orders)
  @JoinColumn({ name: 'salesPartnersId' })
  salesPartner: SalesPartner;

  @OneToMany(() => PaymentTerm, paymentTerm => paymentTerm.order)
  paymentTerm: PaymentTerm[];
}