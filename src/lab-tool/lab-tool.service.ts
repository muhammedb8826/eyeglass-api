import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LabTool } from 'src/entities/lab-tool.entity';
import { CreateLabToolDto } from './dto/create-lab-tool.dto';
import { UpdateLabToolDto } from './dto/update-lab-tool.dto';

@Injectable()
export class LabToolService {
  constructor(
    @InjectRepository(LabTool)
    private readonly labToolRepository: Repository<LabTool>,
  ) {}

  async create(dto: CreateLabToolDto): Promise<LabTool> {
    if (dto.baseCurveMin > dto.baseCurveMax) {
      throw new BadRequestException('baseCurveMin must be less than or equal to baseCurveMax');
    }
    const entity = this.labToolRepository.create({
      code: dto.code ?? null,
      baseCurveMin: dto.baseCurveMin,
      baseCurveMax: dto.baseCurveMax,
      quantity: dto.quantity ?? 1,
    });
    return this.labToolRepository.save(entity);
  }

  async findAll(skip: number = 0, take: number = 50): Promise<{ data: LabTool[]; total: number }> {
    const [data, total] = await this.labToolRepository.findAndCount({
      order: { baseCurveMin: 'ASC', baseCurveMax: 'ASC' },
      skip: Number(skip),
      take: Number(take),
    });
    return { data, total };
  }

  async findOne(id: string): Promise<LabTool> {
    const tool = await this.labToolRepository.findOne({ where: { id } });
    if (!tool) {
      throw new NotFoundException(`Lab tool with ID ${id} not found`);
    }
    return tool;
  }

  async update(id: string, dto: UpdateLabToolDto): Promise<LabTool> {
    const tool = await this.findOne(id);
    if (dto.baseCurveMin != null && dto.baseCurveMax != null && dto.baseCurveMin > dto.baseCurveMax) {
      throw new BadRequestException('baseCurveMin must be less than or equal to baseCurveMax');
    }
    Object.assign(tool, dto);
    return this.labToolRepository.save(tool);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.labToolRepository.delete(id);
  }

  /**
   * Find a lab tool that covers the given base curve and has quantity > 0.
   * A tool covers baseCurve if baseCurveMin <= baseCurve <= baseCurveMax.
   */
  async findAvailableForBaseCurve(baseCurve: number): Promise<LabTool | null> {
    const tools = await this.labToolRepository
      .createQueryBuilder('t')
      .where('t.baseCurveMin <= :bc', { bc: baseCurve })
      .andWhere('t.baseCurveMax >= :bc', { bc: baseCurve })
      .andWhere('t.quantity > 0')
      .orderBy('t.baseCurveMax - t.baseCurveMin', 'ASC') // prefer narrowest match
      .getMany();
    return tools.length > 0 ? tools[0] : null;
  }

  /**
   * Check which base curves (from the list) have no available lab tool.
   * Returns the list of base curve values that cannot be produced.
   */
  async checkAvailabilityForBaseCurves(baseCurves: number[]): Promise<{ missing: number[] }> {
    const unique = [...new Set(baseCurves)].filter(bc => bc != null && !Number.isNaN(bc));
    const missing: number[] = [];
    for (const bc of unique) {
      const tool = await this.findAvailableForBaseCurve(bc);
      if (!tool) {
        missing.push(bc);
      }
    }
    return { missing };
  }
}
