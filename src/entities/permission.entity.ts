import {
  Entity,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
  PrimaryColumn,
} from 'typeorm';
import { randomUUID } from 'crypto';

@Entity('permissions')
export class Permission {
  @PrimaryColumn('uuid')
  id: string;

  @BeforeInsert()
  setId() {
    if (!this.id) {
      this.id = randomUUID();
    }
  }

  /** Stable code, e.g. users.manage */
  @Column({ unique: true })
  code: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
