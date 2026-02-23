import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { DiscountsService } from './discounts.service';
import { CreateDiscountDto } from './dto/create-discount.dto';
import { UpdateDiscountDto } from './dto/update-discount.dto';

@Controller('discounts')
export class DiscountsController {
  constructor(private readonly discountsService: DiscountsService) {}

  @Post()
  async create(@Body() createDiscountDto: CreateDiscountDto) {
    return this.discountsService.create(createDiscountDto);
  }

  @Get()
  async findAll(@Query('page') page:number = 1, @Query('limit') limit: number = 10) {
    const skip = (page - 1) * limit
    const take = limit
    return this.discountsService.findAll(skip, take);
  }

  @Get('all')
  async findAllDiscounts() {
    return this.discountsService.findAllDiscounts();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.discountsService.findOne(id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateDiscountDto: UpdateDiscountDto) {
    return this.discountsService.update(id, updateDiscountDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.discountsService.remove(id);
  }
}
