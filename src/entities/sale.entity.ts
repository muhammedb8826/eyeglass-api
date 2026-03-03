import { Entity, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany, BeforeInsert, PrimaryColumn } from 'typeorm';
import { User } from './user.entity';
import { SaleItems } from './sale-item.entity';
import { randomUUID } from 'crypto';

@Entity('sales')
export class Sale {
  @PrimaryColumn('uuid')
  id: string;

  @BeforeInsert()
  setId() {
    if (!this.id) {
      this.id = randomUUID();
    }
  }

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