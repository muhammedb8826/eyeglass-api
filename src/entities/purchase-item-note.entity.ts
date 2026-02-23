import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { PurchaseItems } from './purchase-item.entity';
import { User } from './user.entity';

@Entity('purchase_item_note')
@Index(['purchaseItemId'])
@Index(['userId'])
export class PurchaseItemNote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

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