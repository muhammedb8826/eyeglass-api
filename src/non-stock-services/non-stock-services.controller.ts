import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { NonStockServicesService } from './non-stock-services.service';
import { CreateNonStockServiceDto } from './dto/create-non-stock-service.dto';
import { UpdateNonStockServiceDto } from './dto/update-non-stock-service.dto';
import { Public } from '../decorators';

@Controller('non-stock-services')
export class NonStockServicesController {
  constructor(private readonly nonStockServicesService: NonStockServicesService) {}

  @Public()
  @Post()
  create(@Body() createNonStockServiceDto: CreateNonStockServiceDto) {
    return this.nonStockServicesService.create(createNonStockServiceDto);
  }

  @Get()
  findAll(@Query('page') page:number = 1, @Query('limit') limit: number = 10) {
    const skip = (page - 1) * limit
    const take = limit
    return this.nonStockServicesService.findAll(skip, take);
  }

  @Public()
  @Get('all')
  findAllNonStockServices() {
    return this.nonStockServicesService.findAllNonStockServices();
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.nonStockServicesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateNonStockServiceDto: UpdateNonStockServiceDto) {
    return this.nonStockServicesService.update(id, updateNonStockServiceDto);
  }

  @Public()
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.nonStockServicesService.remove(id);
  }
}
