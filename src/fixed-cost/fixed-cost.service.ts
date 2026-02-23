import { Injectable, ConflictException } from '@nestjs/common';
import { CreateFixedCostDto } from './dto/create-fixed-cost.dto';
import { UpdateFixedCostDto } from './dto/update-fixed-cost.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FixedCost } from 'src/entities/fixed-cost.entity';

@Injectable()
export class FixedCostService {
  constructor(
    @InjectRepository(FixedCost)
    private fixedCostRepository: Repository<FixedCost>,
  ) {}

  async create(createFixedCostDto: CreateFixedCostDto) {
    try {
      return await this.fixedCostRepository.save(createFixedCostDto);
    } catch (error) {
      // MySQL error code for duplicate entry is 1062
      if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
        throw new ConflictException('A fixed cost with this description already exists.');
      }
      throw error;
    }
  }

  async findAll(skip: number, take: number) {
    const [fixedCosts, total] = await this.fixedCostRepository.findAndCount({
      skip: +skip,
      take: +take,
      order: { createdAt: 'DESC' },
    });
    return { fixedCosts, total };
  }

  findOne(id: string) {
    return this.fixedCostRepository.findOne({ where: { id } });
  }

  update(id: string, updateFixedCostDto: UpdateFixedCostDto) {
    return this.fixedCostRepository.update(id, updateFixedCostDto);
  }

  remove(id: string) {
    return this.fixedCostRepository.delete(id);
  }
}
