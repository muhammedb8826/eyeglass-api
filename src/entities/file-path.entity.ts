import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Unique } from 'typeorm';

@Entity('file_path')
@Unique(['description'])
export class FilePath {
  @PrimaryGeneratedColumn('uuid')
  id: string;

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