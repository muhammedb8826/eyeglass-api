import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { Vendor } from 'src/entities/vendor.entity';

@Injectable()
export class VendorsService {
  constructor(
    @InjectRepository(Vendor)
    private vendorRepository: Repository<Vendor>
  ) {}

  async create(createVendorDto: CreateVendorDto) {
    const existingByName = await this.vendorRepository.findOne({
      where: {
        fullName: ILike(createVendorDto.fullName)
      }
    });

    if (existingByName) {
      throw new ConflictException('Vendor already exists');
    }

    // Email is now optional and not unique, so no need to check for duplicates

    const existingByPhone = await this.vendorRepository.findOne({
      where: {
        phone: createVendorDto.phone
      }
    });

    if (existingByPhone) {
      throw new ConflictException('Vendor phone already exists');
    }

    const vendor = this.vendorRepository.create({
      fullName: createVendorDto.fullName,
      address: createVendorDto.address,
      email: createVendorDto.email,
      phone: createVendorDto.phone,
      description: createVendorDto.description,
      reference: createVendorDto.reference,
      company: createVendorDto.company
    });

    return await this.vendorRepository.save(vendor);
  }

  async findAll(skip: number, take: number) {
    const [vendors, total] = await this.vendorRepository.findAndCount({
      skip: Number(skip),
      take: Number(take),
      order: {
        createdAt: 'DESC'
      }
    });

    return {
      vendors,
      total
    };
  }

  async findAllVendors(search?: string) {
    const queryBuilder = this.vendorRepository
      .createQueryBuilder('vendor')
      .orderBy('vendor.createdAt', 'DESC');

    if (search) {
      queryBuilder.where(
        '(LOWER(vendor.fullName) LIKE LOWER(:search) OR LOWER(vendor.email) LIKE LOWER(:search) OR LOWER(vendor.phone) LIKE LOWER(:search) OR LOWER(vendor.address) LIKE LOWER(:search) OR LOWER(vendor.company) LIKE LOWER(:search))',
        { search: `%${search}%` }
      );
    }

    return queryBuilder.getMany();
  }

  async findOne(id: string) {
    const vendor = await this.vendorRepository.findOne({
      where: { id }
    });
    
    if (!vendor) {
      throw new NotFoundException(`Vendor with ID ${id} not found`);
    }
    
    return vendor;
  }

  async update(id: string, updateVendorDto: UpdateVendorDto) {
    const vendor = await this.vendorRepository.findOne({ where: { id } });
    if (!vendor) {
      throw new NotFoundException(`Vendor with ID ${id} not found`);
    }

    await this.vendorRepository.update(id, updateVendorDto);
    return this.vendorRepository.findOne({ where: { id } });
  }

  async remove(id: string) {
    const vendor = await this.vendorRepository.findOne({ where: { id } });
    if (!vendor) {
      throw new NotFoundException(`Vendor with ID ${id} not found`);
    }
    return this.vendorRepository.remove(vendor);
  }
}
