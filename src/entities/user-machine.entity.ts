import { Entity, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Unique, BeforeInsert, PrimaryColumn } from 'typeorm';
import { User } from './user.entity';
import { Machine } from './machine.entity';
import { randomUUID } from 'crypto';

@Entity('user_machine')
@Unique(['userId', 'machineId'])
export class UserMachine {
  @PrimaryColumn('uuid')
  id: string;

  @BeforeInsert()
  setId() {
    if (!this.id) {
      this.id = randomUUID();
    }
  }

  @Column()
  userId: string;

  @Column()
  machineId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Machine, machine => machine.users)
  @JoinColumn({ name: 'machineId' })
  machine: Machine;

  @ManyToOne(() => User, user => user.machines)
  @JoinColumn({ name: 'userId' })
  user: User;
}