import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { CreateUnitCategoryDto } from './dto/create-unit-category.dto';
import { UpdateUnitCategoryDto } from './dto/update-unit-category.dto';
import { UnitCategory } from 'src/entities/unit-category.entity';
import { Item } from 'src/entities/item.entity';


@Injectable()
export class UnitCategoryService {
  constructor(
    @InjectRepository(UnitCategory)
    private unitCategoryRepository: Repository<UnitCategory>,
    @InjectRepository(Item)
    private itemRepository: Repository<Item>
  ) {}

  async create(createUnitCategoryDto: CreateUnitCategoryDto) {
    const { name, description } = createUnitCategoryDto;

    const existingByName = await this.unitCategoryRepository.findOne({
      where: {
        name: ILike(name),
      },
    });

    if (existingByName) throw new ConflictException('Unit Category already exists');

    const unitCategory = this.unitCategoryRepository.create({
      name,
      description,
    });

    return await this.unitCategoryRepository.save(unitCategory);
  }

  async findAll(skip: number, take: number) {
    const [unitCategories, total] = await this.unitCategoryRepository.findAndCount({
      skip: +skip,
      take: +take,
      order: { createdAt: 'DESC' },
      relations: { items: true, uoms: true }
    });
    return { unitCategories, total };
  }

  async findAllUnitCategory() {
    return this.unitCategoryRepository.find({
      relations: {
        items: true,
        uoms: true
      }
    });
  }

  async findOne(id: string) {
    const unitCategory = await this.unitCategoryRepository.findOne({
      where: { id },
      relations: { items: true, uoms: true },
    });
    if (!unitCategory) throw new NotFoundException('Unit Category not found');
    return unitCategory;
  }

  async update(id: string, updateUnitCategoryDto: UpdateUnitCategoryDto) {
    const unitCategory = await this.unitCategoryRepository.findOne({ where: { id } });
    if (!unitCategory) {
      throw new NotFoundException('Unit Category not found');
    }

    const { name, description } = updateUnitCategoryDto;

    await this.unitCategoryRepository.update(id, {
      name,
      description,
    });

    return this.unitCategoryRepository.findOne({
      where: { id },
      relations: { uoms: true, items: true },
    });
  }

  async remove(id: string) {
    const unitCategory = await this.unitCategoryRepository.findOne({
      where: { id },
      relations: { items: true, uoms: true },
    });

    if (!unitCategory) throw new NotFoundException('Unit Category not found');
    if (unitCategory.items.length > 0) throw new BadRequestException('Cannot delete. Unit Category is assigned to items.');

    for (const uom of unitCategory.uoms) {
      const isUomInUse = await this.itemRepository.findOne({
        where: [
          { defaultUomId: uom.id },
          { purchaseUomId: uom.id },
        ],
      });
      if (isUomInUse) throw new BadRequestException(`Cannot delete. UOM ${uom.name} is in use.`);
    }

    return this.unitCategoryRepository.remove(unitCategory);
  }
}
