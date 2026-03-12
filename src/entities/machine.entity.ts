import { Entity, Column, OneToMany, CreateDateColumn, UpdateDateColumn, BeforeInsert, PrimaryColumn } from 'typeorm';
import { UserMachine } from './user-machine.entity';
import { randomUUID } from 'crypto';

@Entity()
export class Machine {
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

  @Column({ default: true })
  status: boolean;

  @Column({ nullable: true })
  description: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => UserMachine, userMachine => userMachine.machine)
  users: UserMachine[];
}