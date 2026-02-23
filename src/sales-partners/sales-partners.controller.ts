import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { SalesPartnersService } from './sales-partners.service';
import { CreateSalesPartnerDto } from './dto/create-sales-partner.dto';
import { UpdateSalesPartnerDto } from './dto/update-sales-partner.dto';

@Controller('sales-partners')
export class SalesPartnersController {
  constructor(private readonly salesPartnersService: SalesPartnersService) {}

  @Post()
  create(@Body() createSalesPartnerDto: CreateSalesPartnerDto) {
    return this.salesPartnersService.create(createSalesPartnerDto);
  }

  @Get()
  findAll(@Query('page') page:number = 1, @Query('limit') limit: number = 10) {
    const skip = (page - 1) * limit
    const take = limit
    return this.salesPartnersService.findAll(skip, take);
  }

  @Get('all')
  finAllSalesPartners(@Query('search') search?: string) {
    return this.salesPartnersService.findAllSalesPartners(search);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.salesPartnersService.findOne(id);
  }


  @Patch(':id')
  update(@Param('id') id: string, @Body() updateSalesPartnerDto: UpdateSalesPartnerDto) {
    return this.salesPartnersService.update(id, updateSalesPartnerDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.salesPartnersService.remove(id);
  }
}
