import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { User } from './user.entity';
import { SaleItems } from './sale-item.entity';

@Entity('sales')
export class Sale {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  series: string;

  @Column()
  operatorId: string;

  @Column()
  status: string;

  @CreateDateColumn()
  orderDate: Date;

  @Column({ nullable: true })
  note: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column()
  totalQuantity: number;

  @OneToMany(() => SaleItems, saleItems => saleItems.sale)
  saleItems: SaleItems[];

  @ManyToOne(() => User, user => user.operator)
  @JoinColumn({ name: 'operatorId' })
  operator: User;
}