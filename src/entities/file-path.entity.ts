import { randomUUID } from 'crypto';
import { Entity, Column, CreateDateColumn, UpdateDateColumn, Unique, BeforeInsert, PrimaryColumn } from 'typeorm';

@Entity('file_path')
@Unique(['description'])
export class FilePath {
  @PrimaryColumn('uuid')
  id: string;

  @BeforeInsert()
  setId() {
    if (!this.id) {
      this.id = randomUUID();
    }
  }

  @Column()
  filePath: string;

  @Column()
  fileType: string;

  @Column()
  description: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}