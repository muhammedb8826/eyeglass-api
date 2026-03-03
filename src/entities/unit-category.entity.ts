import { Entity, Column, CreateDateColumn, UpdateDateColumn, OneToMany, BeforeInsert, PrimaryColumn } from 'typeorm';
import { UOM } from './uom.entity';
import { Item } from './item.entity';
import { randomUUID } from 'crypto';

@Entity('unit_category')
export class UnitCategory {
  @PrimaryColumn('uuid')
  id: string;

  @BeforeInsert()
  setId() {
    if (!this.id) {
      this.id = randomUUID();
    }
  }

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