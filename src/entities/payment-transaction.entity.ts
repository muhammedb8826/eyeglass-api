import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { PaymentTerm } from './payment-term.entity';

@Entity('payment_transactions')
export class PaymentTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  date: Date;

  @Column()
  paymentTermId: string;

  @Column()
  paymentMethod: string;

  @Column()
  reference: string;

  @Column('float')
  amount: number;

  @Column()
  status: string;

  @Column({ nullable: true })
  description: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => PaymentTerm, paymentTerm => paymentTerm.transactions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'paymentTermId' })
  paymentTerm: PaymentTerm;
}