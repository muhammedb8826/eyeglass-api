import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { RequirePermissions } from 'src/decorators/permissions.decorator';
import { Permissions } from 'src/permissions/permission.constants';

@Controller('customers')
@RequirePermissions(Permissions.CUSTOMERS_READ)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @RequirePermissions(Permissions.CUSTOMERS_WRITE)
  create(@Body() createCustomerDto: CreateCustomerDto) {
    return this.customersService.create(createCustomerDto);
  }

  @Get()
  findAll(@Query('page') page:number = 1, @Query('limit') limit: number = 10) {
    const skip = (page - 1) * limit
    const take = limit
    return this.customersService.findAll(skip, take);
  }

@Get('all')
  findAllCustomers(@Query('search') search?: string) {
    return this.customersService.findAllCustomers(search);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.customersService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions(Permissions.CUSTOMERS_WRITE)
  update(@Param('id') id: string, @Body() updateCustomerDto: UpdateCustomerDto) {
    return this.customersService.update(id, updateCustomerDto);
  }

  @Delete(':id')
  @RequirePermissions(Permissions.CUSTOMERS_WRITE)
  remove(@Param('id') id: string) {
    return this.customersService.remove(id);
  }
}
