import { ConflictException, Injectable } from '@nestjs/common';
import { CreateFilePathDto } from './dto/create-file-path.dto';
import { UpdateFilePathDto } from './dto/update-file-path.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FilePath } from 'src/entities/file-path.entity';

@Injectable()
export class FilePathService {
  constructor(
    @InjectRepository(FilePath)
    private filePathRepository: Repository<FilePath>,
  ) {}

  async create(createFilePathDto: CreateFilePathDto) {
    try {
      return await this.filePathRepository.save(createFilePathDto);
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
        throw new ConflictException('A file path with this description already exists.');
      }
      throw error;
    }
  }

  async findAll(skip: number, take: number) {
    const [filePaths, total] = await this.filePathRepository.findAndCount({
      skip: +skip,
      take: +take,
      order: { createdAt: 'DESC' },
    });
    return { filePaths, total };
  }

  async findOne(id: string) {
    return await this.filePathRepository.findOne({ where: { id } });
  }

  async update(id: string, updateFilePathDto: UpdateFilePathDto) {
    return await this.filePathRepository.update(id, updateFilePathDto);
  }

  async remove(id: string) {
    return await this.filePathRepository.delete(id);
  }
}
