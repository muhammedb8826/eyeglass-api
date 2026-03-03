import { Entity, Column, CreateDateColumn, UpdateDateColumn, OneToMany, BeforeInsert, PrimaryColumn } from 'typeorm';
import { Purchase } from './purchase.entity';
import { randomUUID } from 'crypto';

@Entity('vendors')
export class Vendor {
  @PrimaryColumn('uuid')
  id: string;

  @BeforeInsert()
  setId() {
    if (!this.id) {
      this.id = randomUUID();
    }
  }

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