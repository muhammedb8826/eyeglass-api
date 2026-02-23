import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { OrderItems } from './order-item.entity';
import { User } from './user.entity';

@Entity('order_item_notes')
export class OrderItemNotes {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  text: string;

  @Column()
  hour: Date;

  @Column()
  date: Date;

  @Column()
  userId: string;

  @Column()
  orderItemId: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => OrderItems, orderItem => orderItem.orderItemNotes)
  @JoinColumn({ name: 'orderItemId' })
  orderItem: OrderItems;

  @ManyToOne(() => User, user => user.orderItemNotes)
  @JoinColumn({ name: 'userId' })
  user: User;
}