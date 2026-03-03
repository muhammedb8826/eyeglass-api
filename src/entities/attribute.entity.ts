import { Entity, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, Unique, BeforeInsert, PrimaryColumn } from 'typeorm';
import { Item } from './item.entity';
import { randomUUID } from 'crypto';

@Entity()
@Unique(['name', 'itemId'])
export class Attribute {
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
  value: string;

  @Column()
  itemId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Item, item => item.attributes)
  items: Item;
}