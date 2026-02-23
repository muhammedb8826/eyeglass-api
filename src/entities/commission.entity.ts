import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToOne, JoinColumn, OneToMany, ManyToOne } from 'typeorm';
import { Order } from './order.entity';
import { SalesPartner } from './sales-partner.entity';
import { CommissionTransaction } from './commission-transaction.entity';

@Entity('commissions')
export class Commission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  orderId: string;

  @Column()
  salesPartnerId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column('float')
  totalAmount: number;

  @Column('float')
  paidAmount: number;

  @OneToMany(() => CommissionTransaction, transaction => transaction.commission, { onDelete: 'CASCADE' })
  transactions: CommissionTransaction[];

  @OneToOne(() => Order, order => order.commission, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @ManyToOne(() => SalesPartner, salesPartner => salesPartner.commissions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'salesPartnerId' })
  salesPartner: SalesPartner;
}