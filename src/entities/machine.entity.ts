import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { UserMachine } from './user-machine.entity';
import { Item } from './item.entity';

@Entity()
export class Machine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

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

  @OneToMany(() => Item, item => item.machine)
  items: Item[];
}