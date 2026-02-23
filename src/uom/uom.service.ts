import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateUomDto } from './dto/create-uom.dto';
import { UpdateUomDto } from './dto/update-uom.dto';
import { UOM } from 'src/entities/uom.entity';
import { UnitCategory } from 'src/entities/unit-category.entity';

@Injectable()
export class UomService {
  constructor(
    @InjectRepository(UOM)
    private uomRepository: Repository<UOM>,
    @InjectRepository(UnitCategory)
    private unitCategoryRepository: Repository<UnitCategory>
  ) {}

  async create(createUomDto: CreateUomDto) {
    // Check if the UOM already exists with the same name, abbreviation, and conversion rate
    const existingUom = await this.uomRepository.findOne({
      where: {
        name: createUomDto.name,
        abbreviation: createUomDto.abbreviation,
        conversionRate: parseFloat(createUomDto.conversionRate.toString()),
        unitCategoryId: createUomDto.unitCategoryId,
      }
    });
    
    // If it exists, return the existing UOM
    if (existingUom) {
      return null;
    }

    // Check if there is already a base unit in this category
    if (createUomDto.baseUnit) {
      const existingBaseUnit = await this.uomRepository.findOne({
        where: {
          baseUnit: true,
          unitCategoryId: createUomDto.unitCategoryId,
        }
      });

      // If a base unit exists, throw an exception
      if (existingBaseUnit) {
        throw new ConflictException('A base unit already exists in this category. Only one base unit is allowed.');
      }
    }

    // If it doesn't exist, create a new one
    const uom = this.uomRepository.create({
      name: createUomDto.name,
      abbreviation: createUomDto.abbreviation,
      conversionRate: parseFloat(createUomDto.conversionRate.toString()),
      baseUnit: createUomDto.baseUnit,
      unitCategoryId: createUomDto.unitCategoryId,
    });

    return await this.uomRepository.save(uom);
  }

  async findAll(categoryId?: string) {
    // If no categoryId is provided, return an empty array
    if (!categoryId) {
      return [];
    }
  
    // Check if the category with the provided id exists
    const categoryExists = await this.unitCategoryRepository.findOne({
      where: { id: categoryId },
    });

    // If the category does not exist, return an empty array
    if (!categoryExists) {
      return [];
    }
  
    // Return uOM instances belonging to the provided categoryId
    const results = await this.uomRepository.find({
      where: { unitCategoryId: categoryId },
      relations: {
        unitCategory: true,
      },
    });
    return results;
  }

  async findAllUoms() {
    return this.uomRepository.find({
      relations: {
        unitCategory: true,
      },
    });
  }

  async findOne(id: string) {
    const uom = await this.uomRepository.findOne({
      where: { id },
      relations: {
        unitCategory: true
      }
    });

    if (!uom) {
      throw new NotFoundException('UOM not found');
    }

    return uom;
  }

  async update(id: string, updateUomDto: UpdateUomDto) {
    // Find the UOM being updated
    const uomToUpdate = await this.uomRepository.findOne({
      where: { id },
    });

    if (!uomToUpdate) {
      throw new NotFoundException('UOM not found');
    }

    // Check if the updated values conflict with existing UOMs
    const existingUom = await this.uomRepository.findOne({
      where: {
        name: updateUomDto.name,
        abbreviation: updateUomDto.abbreviation,
        conversionRate: parseFloat(updateUomDto.conversionRate.toString()),
        unitCategoryId: updateUomDto.unitCategoryId,
        id: { not: id } as any // Exclude the current UOM being updated
      }
    });

    if (existingUom) {
      throw new ConflictException('UOM already exists in this category');
    }

    // If the new baseUnit value is true, handle existing base unit
    if (updateUomDto.baseUnit) {
      // Find any existing base unit in the same category
      const existingBaseUnit = await this.uomRepository.findOne({
        where: {
          baseUnit: true,
          unitCategoryId: updateUomDto.unitCategoryId,
          id: { not: id } as any // Exclude the current UOM being updated
        }
      });

      // If an existing base unit is found, set it to false
      if (existingBaseUnit) {
        await this.uomRepository.update(
          { id: existingBaseUnit.id },
          { baseUnit: false }
        );
      }
    }

    await this.uomRepository.update(id, {
      name: updateUomDto.name,
      abbreviation: updateUomDto.abbreviation,
      conversionRate: parseFloat(updateUomDto.conversionRate.toString()),
      baseUnit: updateUomDto.baseUnit,
      unitCategoryId: updateUomDto.unitCategoryId,
    });

    return this.uomRepository.findOne({
      where: { id },
      relations: { unitCategory: true }
    });
  }

  async remove(id: string) {
    const uom = await this.uomRepository.findOne({ where: { id } });
    if (!uom) {
      throw new NotFoundException('UOM not found');
    }

    try {
      return await this.uomRepository.remove(uom);
    } catch (error) {
      throw new NotFoundException('UOM not found');
    }
  }
}
