import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { UOM } from './uom.entity';
import { Item } from './item.entity';

@Entity('unit_category')
export class UnitCategory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column()
  description: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => UOM, uom => uom.unitCategory)
  uoms: UOM[];

  @OneToMany(() => Item, item => item.unitCategory)
  items: Item[];
}