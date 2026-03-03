import { Entity, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, BeforeInsert, PrimaryColumn } from 'typeorm';
import { PaymentTerm } from './payment-term.entity';
import { randomUUID } from 'crypto';

@Entity('payment_transactions')
export class PaymentTransaction {
  @PrimaryColumn('uuid')
  id: string;

  @BeforeInsert()
  setId() {
    if (!this.id) {
      this.id = randomUUID();
    }
  }

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