import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { Customer } from 'src/entities/customer.entity';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>
  ) {}

  async create(createCustomerDto: CreateCustomerDto) {
    // Check for existing customer by phone number
    const existingCustomerByPhone = await this.customerRepository.findOne({
      where: {
        phone: createCustomerDto.phone,
      },
    });

    if (existingCustomerByPhone) {
      throw new ConflictException('Customer with this phone number already exists');
    }

    // Email is now optional and not unique, so no need to check for duplicates

    const customer = this.customerRepository.create({
      fullName: createCustomerDto.fullName,
      address: createCustomerDto.address,
      email: createCustomerDto.email,
      phone: createCustomerDto.phone,
      company: createCustomerDto.company,
      description: createCustomerDto.description
    });

    return await this.customerRepository.save(customer);
  }

  async findAll(skip: number, take: number) {
    const [customers, total] = await this.customerRepository.findAndCount({
      skip: Number(skip),
      take: Number(take),
      order: {
        createdAt: 'DESC'
      }
    });

    return { customers, total };
  }

  async findAllCustomers(search?: string) {
    const queryBuilder = this.customerRepository
      .createQueryBuilder('customer')
      .orderBy('customer.createdAt', 'DESC');

    if (search) {
      queryBuilder.where(
        '(LOWER(customer.fullName) LIKE LOWER(:search) OR LOWER(customer.email) LIKE LOWER(:search) OR LOWER(customer.phone) LIKE LOWER(:search))',
        { search: `%${search}%` }
      );
    }

    return queryBuilder.getMany();
  }

  async findOne(id: string) {
    const customer = await this.customerRepository.findOne({
      where: { id }
    });
    
    if (!customer) {
      throw new NotFoundException(`Customer with ID ${id} not found`);
    }
    
    return customer;
  }

  async update(id: string, updateCustomerDto: UpdateCustomerDto) {
    const customer = await this.customerRepository.findOne({ where: { id } });
    if (!customer) {
      throw new NotFoundException(`Customer with ID ${id} not found`);
    }
    
    // Check for existing customer by phone number
    const existingCustomerByPhone = await this.customerRepository.findOne({
      where: {
        phone: updateCustomerDto.phone,
      },
    });

    if (existingCustomerByPhone && existingCustomerByPhone.id !== id) {
      throw new ConflictException('Customer with this phone number already exists');
    }

    // Email is now optional and not unique, so no need to check for duplicates

    await this.customerRepository.update(id, updateCustomerDto);
    return this.customerRepository.findOne({ where: { id } });
  }

  async remove(id: string) {
    const customer = await this.customerRepository.findOne({ where: { id } });
    if (!customer) {
      throw new NotFoundException(`Customer with ID ${id} not found`);
    }
    return this.customerRepository.remove(customer);
  }
}
