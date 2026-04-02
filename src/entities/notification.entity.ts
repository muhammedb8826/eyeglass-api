import {
  Entity,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  BeforeInsert,
  PrimaryColumn,
  Index,
} from 'typeorm';
import { randomUUID } from 'crypto';
import { User } from './user.entity';

export type NotificationType =
  | 'SYSTEM'
  | 'SECURITY'
  | 'STORE_REQUEST'
  | 'PURCHASE'
  | 'ORDER'
  | 'QC'
  | 'INVENTORY';

@Entity('notifications')
@Index(['recipientId', 'isRead', 'createdAt'])
export class Notification {
  @PrimaryColumn('uuid')
  id: string;

  @BeforeInsert()
  setId() {
    if (!this.id) {
      this.id = randomUUID();
    }
  }

  @Column()
  recipientId: string;

  @Column({ type: 'varchar', length: 30 })
  type: NotificationType;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  message: string;

  @Column({ type: 'json', nullable: true })
  data: any;

  @Column({ default: false })
  isRead: boolean;

  // Postgres: use timestamp/timestamptz; "datetime" is not supported
  @Column({ type: 'timestamptz', nullable: true })
  readAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recipientId' })
  recipient: User;
}

