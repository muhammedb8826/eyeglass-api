import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreatePricingDto } from './dto/create-pricing.dto';
import { UpdatePricingDto } from './dto/update-pricing.dto';
import { Pricing } from 'src/entities/pricing.entity';

@Injectable()
export class PricingService {
  constructor(
    @InjectRepository(Pricing)
    private readonly pricingRepository: Repository<Pricing>,
  ) {}

  async create(createPricingDto: CreatePricingDto) {
    const { itemId, serviceId, nonStockServiceId, isNonStockService } = createPricingDto;

    // Auto-correct the isNonStockService flag based on which ID is provided
    let correctedIsNonStockService = isNonStockService;
    if (nonStockServiceId && !serviceId) {
      correctedIsNonStockService = true;
    } else if (serviceId && !nonStockServiceId) {
      correctedIsNonStockService = false;
    }

    // Check for existing pricing based on service type
    let existing;
    if (correctedIsNonStockService && nonStockServiceId) {
      existing = await this.pricingRepository.findOne({
        where: { itemId, nonStockServiceId, isNonStockService: true }
      });
    } else if (serviceId) {
      existing = await this.pricingRepository.findOne({
        where: { itemId, serviceId, isNonStockService: false }
      });
    }

    if (existing) {
      throw new ConflictException('Pricing already exists for this item and service');
    }

    // Create pricing with corrected flag
    const pricingData = {
      ...createPricingDto,
      isNonStockService: correctedIsNonStockService
    };

    const pricing = this.pricingRepository.create(pricingData);
    return await this.pricingRepository.save(pricing);
  }

  async findAll(skip: number, take: number) {
    const [pricings, total] = await this.pricingRepository.findAndCount({
      skip: +skip,
      take: +take,
      order: { createdAt: 'DESC' },
      relations: ['item', 'service', 'nonStockService']
    });
    
    return { pricings, total };
  }

  async findAllPricing() {
    return this.pricingRepository.find({
      relations: ['item', 'service', 'nonStockService']
    });
  }

  async findOne(id: string) {
    const pricing = await this.pricingRepository.findOne({
      where: { id },
      relations: ['item', 'service', 'nonStockService']
    });

    if (!pricing) {
      throw new NotFoundException('Pricing not found');
    }

    return pricing;
  }

  async update(id: string, updatePricingDto: UpdatePricingDto) {
    const existing = await this.pricingRepository.findOne({
      where: { id }
    });

    if (!existing) {
      throw new NotFoundException('Pricing not found');
    }

    // Auto-correct the isNonStockService flag based on which ID is provided
    const { serviceId, nonStockServiceId, isNonStockService } = updatePricingDto;
    let correctedIsNonStockService = isNonStockService;
    
    if (nonStockServiceId && !serviceId) {
      correctedIsNonStockService = true;
    } else if (serviceId && !nonStockServiceId) {
      correctedIsNonStockService = false;
    }

    // Update with corrected flag
    const updateData = {
      ...updatePricingDto,
      isNonStockService: correctedIsNonStockService
    };

    await this.pricingRepository.update(id, updateData);
    
    return await this.pricingRepository.findOne({
      where: { id },
      relations: ['item', 'service', 'nonStockService']
    });
  }

  async remove(id: string) {
    const existing = await this.pricingRepository.findOne({
      where: { id }
    });

    if (!existing) {
      throw new NotFoundException('Pricing not found');
    }

    await this.pricingRepository.remove(existing);
    return { message: `Pricing with ID ${id} removed successfully` };
  }
}
