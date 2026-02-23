import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { CreateMachineDto } from './dto/create-machine.dto';
import { UpdateMachineDto } from './dto/update-machine.dto';
import { Machine } from '../entities/machine.entity';

@Injectable()
export class MachinesService {
  constructor(
    @InjectRepository(Machine)
    private machineRepository: Repository<Machine>
  ) {}

  async create(createMachineDto: CreateMachineDto): Promise<Machine> {
    const booleanValue = Boolean(createMachineDto.status);

    const existingByName = await this.machineRepository.findOne({
      where: {
        name: ILike(createMachineDto.name), // Case-insensitive search
      },
    });
  
    if (existingByName) {
      throw new ConflictException('Machine already exists');
    }

    const machine = this.machineRepository.create({
      name: createMachineDto.name,
      description: createMachineDto.description,
      status: booleanValue
    });

    return await this.machineRepository.save(machine);
  }

  async findAll(skip: number, take: number) {
    const [machines, total] = await this.machineRepository.findAndCount({
      skip: Number(skip),
      take: Number(take),
      order: {
        createdAt: 'DESC'
      }
    });
    
    return {
      machines,
      total
    };
  }

  async findAllMachines() {
    return this.machineRepository.find();
  }

  async findOne(id: string) {
    const machine = await this.machineRepository.findOne({ where: { id } });
    if (!machine) {
      throw new NotFoundException(`Machine with ID ${id} not found`);
    }
    return machine;
  }

  async update(id: string, updateMachineDto: UpdateMachineDto) {
    const machine = await this.machineRepository.findOne({ where: { id } });
    if (!machine) {
      throw new NotFoundException(`Machine with ID ${id} not found`);
    }

    await this.machineRepository.update(id, updateMachineDto);
    return this.machineRepository.findOne({ where: { id } });
  }

  async remove(id: string) {
    const machine = await this.machineRepository.findOne({ where: { id } });
    if (!machine) {
      throw new NotFoundException(`Machine with ID ${id} not found`);
    }
    return this.machineRepository.remove(machine);
  }
}
