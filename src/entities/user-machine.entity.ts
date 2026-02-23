import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { User } from './user.entity';
import { Machine } from './machine.entity';

@Entity('user_machine')
@Unique(['userId', 'machineId'])
export class UserMachine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

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