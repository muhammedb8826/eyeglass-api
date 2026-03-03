import { Entity, Column, CreateDateColumn, ManyToOne, JoinColumn, BeforeInsert, PrimaryColumn } from 'typeorm';
import { OrderItems } from './order-item.entity';
import { User } from './user.entity';
import { randomUUID } from 'crypto';

@Entity('order_item_notes')
export class OrderItemNotes {
  @PrimaryColumn('uuid')
  id: string;

  @BeforeInsert()
  setId() {
    if (!this.id) {
      this.id = randomUUID();
    }
  }

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