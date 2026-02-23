import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Commission } from './commission.entity';

@Entity('commission_transactions')
export class CommissionTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  date: Date;

  @Column('float')
  amount: number;

  @Column('float')
  percentage: number;

  @Column()
  commissionId: string;

  @Column()
  paymentMethod: string;

  @Column()
  reference: string;

  @Column()
  status: string;

  @Column({ nullable: true })
  description: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Commission, commission => commission.transactions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'commissionId' })
  commission: Commission;
}