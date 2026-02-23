import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Unique } from 'typeorm';

@Entity('fixed_cost')
@Unique(['description'])
export class FixedCost {
  @PrimaryGeneratedColumn('uuid')
  id: string;

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