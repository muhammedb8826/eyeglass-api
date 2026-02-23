import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { Service } from 'src/entities/service.entity';

@Injectable()
export class ServicesService {
  constructor(
    @InjectRepository(Service)
    private serviceRepository: Repository<Service>
  ) {}

  async create(createServiceDto: CreateServiceDto): Promise<Service> {
    const existingByName = await this.serviceRepository.findOne({
      where: {
        name: ILike(createServiceDto.name), // Case-insensitive search
      },
    });

    if (existingByName) {
      throw new ConflictException('Service already exists');
    }

    const service = this.serviceRepository.create({
      name: createServiceDto.name,
      description: createServiceDto.description,
      status: createServiceDto.status,
    });

    return await this.serviceRepository.save(service);
  }

  async findAll(skip: number, take: number) {
    const [services, total] = await this.serviceRepository.findAndCount({
      skip: Number(skip),
      take: Number(take),
      order: {
        createdAt: 'DESC'
      }
    });
    
    return {
      services,
      total
    };
  }

  async findAllServices() {
    return this.serviceRepository.find();
  }

  async findOne(id: string) {
    const service = await this.serviceRepository.findOne({ where: { id } });
    if (!service) {
      throw new NotFoundException(`Service with ID ${id} not found`);
    }
    return service;
  }

  async update(id: string, updateServiceDto: UpdateServiceDto) {
    const service = await this.serviceRepository.findOne({ where: { id } });
    if (!service) {
      throw new NotFoundException(`Service with ID ${id} not found`);
    }

    await this.serviceRepository.update(id, updateServiceDto);
    return this.serviceRepository.findOne({ where: { id } });
  }

  async remove(id: string) {
    const service = await this.serviceRepository.findOne({ where: { id } });
    if (!service) {
      throw new NotFoundException(`Service with ID ${id} not found`);
    }
    return this.serviceRepository.remove(service);
  }
}
