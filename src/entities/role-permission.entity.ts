import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  BeforeInsert,
  PrimaryColumn,
  Unique,
} from 'typeorm';
import { randomUUID } from 'crypto';
import { Role } from '../enums/role.enum';
import { Permission } from './permission.entity';

@Entity('role_permissions')
@Unique(['role', 'permissionId'])
export class RolePermission {
  @PrimaryColumn('uuid')
  id: string;

  @BeforeInsert()
  setId() {
    if (!this.id) {
      this.id = randomUUID();
    }
  }

  @Column({ type: 'enum', enum: Role })
  role: Role;

  @Column()
  permissionId: string;

  @ManyToOne(() => Permission, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'permissionId' })
  permission: Permission;
}
