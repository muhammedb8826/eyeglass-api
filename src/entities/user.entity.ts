import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { OrderItemNotes } from './order-item-notes.entity';
import { PurchaseItemNote } from './purchase-item-note.entity';
import { SalesItemNote } from './sales-item-note.entity';
import { UserMachine } from './user-machine.entity';
import { Purchase } from './purchase.entity';
import { Sale } from './sale.entity';
import { Role } from '../enums/role.enum';


@Entity('user')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ nullable: true })
  passwordRT: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column()
  address: string;

  @Column({ nullable: true })
  first_name: string;

  @Column({ default: 'MALE' })
  gender: string;

  @Column({ nullable: true })
  last_name: string;

  @Column({ nullable: true })
  middle_name: string;

  @Column({ unique: true })
  phone: string;

  @Column({ nullable: true })
  profile: string;

  @Column({ type: 'enum', enum: Role, default: Role.ADMIN })
  roles: Role;

  @Column()
  confirm_password: string;

  @Column({ default: true })
  is_active: boolean;

  @OneToMany(() => OrderItemNotes, orderItemNotes => orderItemNotes.user)
  orderItemNotes: OrderItemNotes[];

  @OneToMany(() => PurchaseItemNote, purchaseItemNote => purchaseItemNote.user)
  purchaseItemNotes: PurchaseItemNote[];

  @OneToMany(() => SalesItemNote, salesItemNote => salesItemNote.user)
  salesNotes: SalesItemNote[];

  @OneToMany(() => UserMachine, userMachine => userMachine.user)
  machines: UserMachine[];

  @OneToMany(() => Purchase, purchase => purchase.purchaser)
  purchaser: Purchase[];

  @OneToMany(() => Sale, sale => sale.operator)
  operator: Sale[];
}