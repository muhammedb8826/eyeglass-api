import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateNonStockServiceDto } from './dto/create-non-stock-service.dto';
import { UpdateNonStockServiceDto } from './dto/update-non-stock-service.dto';
import { ILike, Repository } from 'typeorm';
import { NonStockService } from '../entities/non-stock-service.entity';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class NonStockServicesService {
  constructor(
    @InjectRepository(NonStockService)
    private nonStockServiceRepository: Repository<NonStockService>
  ) {}

  async create(createNonStockServiceDto: CreateNonStockServiceDto) {
    const existingByName = await this.nonStockServiceRepository.findOne({
      where: {
        name: ILike(createNonStockServiceDto.name), // Case-insensitive search
      },
    });

    if (existingByName) {
      throw new ConflictException('Non-stock service already exists');
    }

    const nonStockService = this.nonStockServiceRepository.create(createNonStockServiceDto);
    return this.nonStockServiceRepository.save(nonStockService);
  }

  async findAll(skip: number, take: number) {
    const [nonStockServices, total] = await this.nonStockServiceRepository.findAndCount({
      skip: Number(skip),
      take: Number(take),
      order: {
        createdAt: 'DESC'
      }
    });
    return { data: nonStockServices, total };
  }

  async findAllNonStockServices() {
    return await this.nonStockServiceRepository.find();
  }

  async findOne(id: string) {
    const nonStockService = await this.nonStockServiceRepository.findOne({ where: { id } });
    if (!nonStockService) {
      throw new NotFoundException('Non-stock service not found');
    }
    return nonStockService;
  }

  async update(id: string, updateNonStockServiceDto: UpdateNonStockServiceDto) {
    const nonStockService = await this.nonStockServiceRepository.findOne({ where: { id } });
    if (!nonStockService) {
      throw new NotFoundException('Non-stock service not found');
    }
    return this.nonStockServiceRepository.save({ ...nonStockService, ...updateNonStockServiceDto });
  }

  async remove(id: string) {
    const nonStockService = await this.nonStockServiceRepository.findOne({ where: { id } });
    if (!nonStockService) {
      throw new NotFoundException('Non-stock service not found');
    }
    return this.nonStockServiceRepository.remove(nonStockService);
  }
}
