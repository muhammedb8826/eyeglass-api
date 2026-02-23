import { Module } from '@nestjs/common';
import { FilePathService } from './file-path.service';
import { FilePathController } from './file-path.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FilePath } from 'src/entities/file-path.entity';

@Module({
  imports: [TypeOrmModule.forFeature([FilePath])],
  controllers: [FilePathController],
  providers: [FilePathService],
})
export class FilePathModule {}
