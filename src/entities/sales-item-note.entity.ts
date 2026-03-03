import { Entity, Column, ManyToOne, JoinColumn, Index, BeforeInsert, PrimaryColumn } from 'typeorm';
import { SaleItems } from './sale-item.entity';
import { User } from './user.entity';
import { randomUUID } from 'crypto';

@Entity('sales_item_note')
@Index(['saleItemId'])
@Index(['userId'])
export class SalesItemNote {
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
  userId: string;

  @Column()
  date: Date;

  @Column()
  hour: Date;

  @Column()
  saleItemId: string;

  @ManyToOne(() => SaleItems, saleItem => saleItem.saleItemNotes)
  @JoinColumn({ name: 'saleItemId' })
  saleItem: SaleItems;

  @ManyToOne(() => User, user => user.salesNotes)
  @JoinColumn({ name: 'userId' })
  user: User;
}