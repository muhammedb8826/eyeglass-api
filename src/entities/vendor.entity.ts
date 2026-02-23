import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Purchase } from './purchase.entity';

@Entity('vendors')
export class Vendor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  fullName: string;

  @Column({ nullable: true })
  email: string;

  @Column({ unique: true })
  phone: string;

  @Column({ nullable: true })
  company: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  reference: string;

  @Column({ nullable: true })
  description: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Purchase, purchase => purchase.vendor)
  purchases: Purchase[];
}