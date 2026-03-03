import { randomUUID } from 'crypto';
import { Entity, Column, CreateDateColumn, UpdateDateColumn, Unique, BeforeInsert, PrimaryColumn } from 'typeorm';

@Entity('fixed_cost')
@Unique(['description'])
export class FixedCost {
  @PrimaryColumn('uuid')
  id: string;

  @BeforeInsert()
  setId() {
    if (!this.id) {
      this.id = randomUUID();
    }
  }

  @Column('float')
  monthlyFixedCost: number;

  @Column('float')
  dailyFixedCost: number;

  @Column()
  description: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}