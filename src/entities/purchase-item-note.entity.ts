import { Entity, Column, CreateDateColumn, ManyToOne, JoinColumn, Index, BeforeInsert, PrimaryColumn } from 'typeorm';
import { PurchaseItems } from './purchase-item.entity';
import { User } from './user.entity';
import { randomUUID } from 'crypto';

@Entity('purchase_item_note')
@Index(['purchaseItemId'])
@Index(['userId'])
export class PurchaseItemNote {
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
  purchaseItemId: string;

  @ManyToOne(() => PurchaseItems, purchaseItem => purchaseItem.purchaseItemNotes)
  @JoinColumn({ name: 'purchaseItemId' })
  purchaseItem: PurchaseItems;

  @ManyToOne(() => User, user => user.purchaseItemNotes)
  @JoinColumn({ name: 'userId' })
  user: User;

  @CreateDateColumn()
  createdAt: Date;
}