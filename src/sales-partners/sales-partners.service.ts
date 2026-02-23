import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { CreateSalesPartnerDto } from './dto/create-sales-partner.dto';
import { UpdateSalesPartnerDto } from './dto/update-sales-partner.dto';
import { SalesPartner } from 'src/entities/sales-partner.entity';

@Injectable()
export class SalesPartnersService {
  constructor(
    @InjectRepository(SalesPartner)
    private readonly salesPartnerRepository: Repository<SalesPartner>,
  ) {}

  async create(createSalesPartnerDto: CreateSalesPartnerDto) {
    const existingCustomerByPhone = await this.salesPartnerRepository.findOne({
      where: {
        phone: createSalesPartnerDto.phone
      }
    });

    if (existingCustomerByPhone) {
      throw new ConflictException('Sales Partner with this phone number already exists');
    }

    if (createSalesPartnerDto.email) {
      const existingCustomerByEmail = await this.salesPartnerRepository.findOne({
        where: {
          email: createSalesPartnerDto.email
        }
      });

      if (existingCustomerByEmail) {
        throw new ConflictException('Sales Partner with this email already exists');
      }
    }

    const salesPartner = this.salesPartnerRepository.create({
      fullName: createSalesPartnerDto.fullName,
      address: createSalesPartnerDto.address,
      email: createSalesPartnerDto.email,
      phone: createSalesPartnerDto.phone,
      company: createSalesPartnerDto.company,
      description: createSalesPartnerDto.description
    });

    return await this.salesPartnerRepository.save(salesPartner);
  }

  async findAll(skip: number, take: number) {
    const [salesPartners, total] = await this.salesPartnerRepository.findAndCount({
      skip: Number(skip),
      take: Number(take),
      order: {
        createdAt: 'DESC'
      }
    });

    return {
      salesPartners,
      total
    };
  }

  async findAllSalesPartners(search?: string) {
    const whereConditions = search ? [
      { fullName: Like(`%${search}%`) },
      { email: Like(`%${search}%`) },
      { phone: Like(`%${search}%`) },
      { company: Like(`%${search}%`) }
    ] : {};

    return this.salesPartnerRepository.find({
      where: whereConditions,
      order: {
        createdAt: 'DESC'
      }
    });
  }

  async findOne(id: string) {
    return this.salesPartnerRepository.findOne({
      where: { id }
    });
  }

  async update(id: string, updateSalesPartnerDto: UpdateSalesPartnerDto) {
    const currentSalesPartner = await this.salesPartnerRepository.findOne({
      where: { id },
    });

    if (!currentSalesPartner) {
      throw new ConflictException('Sales Partner not found');
    }

    if (updateSalesPartnerDto.email && updateSalesPartnerDto.email !== currentSalesPartner.email) {
      const existingPartnerWithEmail = await this.salesPartnerRepository.findOne({
        where: { email: updateSalesPartnerDto.email },
      });

      if (existingPartnerWithEmail) {
        throw new ConflictException('Email already in use by another sales partner');
      }
    }

    if (updateSalesPartnerDto.phone && updateSalesPartnerDto.phone !== currentSalesPartner.phone) {
      const existingPartnerWithPhone = await this.salesPartnerRepository.findOne({
        where: { phone: updateSalesPartnerDto.phone },
      });

      if (existingPartnerWithPhone) {
        throw new ConflictException('Phone number already in use by another sales partner');
      }
    }

    await this.salesPartnerRepository.update(id, updateSalesPartnerDto);
    
    return this.salesPartnerRepository.findOne({
      where: { id }
    });
  }

  async remove(id: string) {
    const salesPartner = await this.salesPartnerRepository.findOne({
      where: { id }
    });

    if (!salesPartner) {
      throw new ConflictException('Sales Partner not found');
    }

    return this.salesPartnerRepository.remove(salesPartner);
  }
}
