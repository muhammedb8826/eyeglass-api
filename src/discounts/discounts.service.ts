import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateDiscountDto } from './dto/create-discount.dto';
import { UpdateDiscountDto } from './dto/update-discount.dto';
import { Discount } from 'src/entities/discount.entity';
import { Item } from 'src/entities/item.entity';

@Injectable()
export class DiscountsService {
  constructor(
    @InjectRepository(Discount)
    private discountRepository: Repository<Discount>,
    @InjectRepository(Item)
    private itemRepository: Repository<Item>
  ) {}

  async create(createDiscountDto: CreateDiscountDto) {
    const { itemId, level } = createDiscountDto;

    // Check if the item exists
    const item = await this.itemRepository.findOne({
      where: { id: itemId },
    });

    if (!item) {
      throw new ConflictException('Item not found');
    }

    const existing = await this.discountRepository.findOne({
      where: { itemId, level }
    });

    if (existing) {
      throw new ConflictException('Discount already exists');
    }

    const discount = this.discountRepository.create(createDiscountDto);
    return await this.discountRepository.save(discount);
  }

  async findAll(skip: number, take: number) {
    const [discounts, total] = await this.discountRepository.findAndCount({
      skip: +skip,
      take: +take,
      order: { createdAt: 'DESC' },
      relations: { items: true }
    });
    return { discounts, total };
  }

  async findAllDiscounts() {
    return await this.discountRepository.find({
      relations: { items: true }
    });
  }

  async findOne(id: string) {
    const discount = await this.discountRepository.findOne({
      where: { id },
      relations: { items: true }
    });

    if (!discount) {
      throw new NotFoundException('Discount not found');
    }

    return discount;
  }

  async update(id: string, updateDiscountDto: UpdateDiscountDto) {
    const existing = await this.discountRepository.findOne({
      where: { id }
    });

    if (!existing) {
      throw new NotFoundException('Discount not found');
    }

    await this.discountRepository.update(id, updateDiscountDto);
    return this.discountRepository.findOne({ where: { id } });
  }

  async remove(id: string) {
    const discount = await this.discountRepository.findOne({ where: { id } });
    if (!discount) {
      throw new NotFoundException('Discount not found');
    }
    return await this.discountRepository.remove(discount);
  }
}
