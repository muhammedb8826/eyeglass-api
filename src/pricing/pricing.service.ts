import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
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
    const { itemId, itemBaseId, serviceId, nonStockServiceId, isNonStockService } = createPricingDto;

    // Normalize empty strings to undefined so we don't insert "" into uuid columns
    const normalizedServiceId = serviceId && serviceId.trim() !== '' ? serviceId : undefined;
    const normalizedNonStockServiceId = nonStockServiceId && nonStockServiceId.trim() !== '' ? nonStockServiceId : undefined;

    // Auto-correct the isNonStockService flag based on which ID is provided
    let correctedIsNonStockService = isNonStockService;
    if (normalizedNonStockServiceId && !normalizedServiceId) {
      correctedIsNonStockService = true;
    } else if (normalizedServiceId && !normalizedNonStockServiceId) {
      correctedIsNonStockService = false;
    }

    // Check for existing pricing based on service type
    let existing;
    if (correctedIsNonStockService && normalizedNonStockServiceId) {
      existing = await this.pricingRepository.findOne({
        where: {
          itemId,
          ...(itemBaseId ? { itemBaseId } : { itemBaseId: IsNull() }),
          nonStockServiceId: normalizedNonStockServiceId,
          isNonStockService: true,
        }
      });
    } else if (normalizedServiceId) {
      existing = await this.pricingRepository.findOne({
        where: {
          itemId,
          ...(itemBaseId ? { itemBaseId } : { itemBaseId: IsNull() }),
          serviceId: normalizedServiceId,
          isNonStockService: false,
        }
      });
    } else {
      // Item-only pricing: no service IDs at all
      existing = await this.pricingRepository.findOne({
        where: {
          itemId,
          ...(itemBaseId ? { itemBaseId } : { itemBaseId: IsNull() }),
          serviceId: IsNull(),
          nonStockServiceId: IsNull(),
        }
      });
    }

    if (existing) {
      throw new ConflictException('Pricing already exists for this item and service');
    }

    // Create pricing with corrected / normalized fields
    const pricingData: Partial<Pricing> = {
      itemId,
      itemBaseId: itemBaseId || null,
      serviceId: normalizedServiceId ?? null,
      nonStockServiceId: normalizedNonStockServiceId ?? null,
      isNonStockService: correctedIsNonStockService ?? false,
      sellingPrice: createPricingDto.sellingPrice,
      costPrice: createPricingDto.costPrice,
      constant: createPricingDto.constant,
      width: createPricingDto.width,
      height: createPricingDto.height,
      baseUomId: createPricingDto.baseUomId,
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

    // Normalize empty strings and auto-correct the isNonStockService flag
    const { serviceId, nonStockServiceId, isNonStockService, itemBaseId } = updatePricingDto;
    const normalizedServiceId = serviceId && serviceId.trim() !== '' ? serviceId : undefined;
    const normalizedNonStockServiceId = nonStockServiceId && nonStockServiceId.trim() !== '' ? nonStockServiceId : undefined;

    let correctedIsNonStockService = isNonStockService;
    if (normalizedNonStockServiceId && !normalizedServiceId) {
      correctedIsNonStockService = true;
    } else if (normalizedServiceId && !normalizedNonStockServiceId) {
      correctedIsNonStockService = false;
    }

    // Update with corrected / normalized fields
    const updateData = {
      ...updatePricingDto,
      itemBaseId: itemBaseId || null,
      serviceId: normalizedServiceId ?? null,
      nonStockServiceId: normalizedNonStockServiceId ?? null,
      isNonStockService: correctedIsNonStockService ?? false,
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
