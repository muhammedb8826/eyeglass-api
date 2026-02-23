import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { CreatePricingDto } from './dto/create-pricing.dto';
import { UpdatePricingDto } from './dto/update-pricing.dto';
import { Public } from '../decorators/public.decorator';

@Controller('pricing')
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  @Post()
  create(@Body() createPricingDto: CreatePricingDto) {
    console.log(createPricingDto)
    return this.pricingService.create(createPricingDto);
  }

  @Public()
  @Get()
  findAll(@Query('page') page:number = 1, @Query('limit') limit: number = 10) {
    const skip = (page - 1) * limit
    const take = limit
    return this.pricingService.findAll(skip, take);
  }

  @Public()
  @Get('all')
  findAllPricing() {
    return this.pricingService.findAllPricing();
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.pricingService.findOne(id);
  }

  @Public()
  @Patch(':id')
  update(@Param('id') id: string, @Body() updatePricingDto: UpdatePricingDto) {
    return this.pricingService.update(id, updatePricingDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.pricingService.remove(id);
  }
}
