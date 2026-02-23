import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { UnitCategoryService } from './unit-category.service';
import { CreateUnitCategoryDto } from './dto/create-unit-category.dto';
import { UpdateUnitCategoryDto } from './dto/update-unit-category.dto';

@Controller('unit-category')
export class UnitCategoryController {
  constructor(private readonly unitCategoryService: UnitCategoryService) {}

  @Post()
  create(@Body() createUnitCategoryDto: CreateUnitCategoryDto) {
    return this.unitCategoryService.create(createUnitCategoryDto);
  }

  @Get()
  findAll(@Query('page') page:number = 1, @Query('limit') limit: number = 10) {
    const skip = (page - 1) * limit
    const take = limit
    return this.unitCategoryService.findAll(skip, take);
  }

  @Get('all')
  findAllUnitCategory() {
    return this.unitCategoryService.findAllUnitCategory();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.unitCategoryService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUnitCategoryDto: UpdateUnitCategoryDto) {
    return this.unitCategoryService.update(id, updateUnitCategoryDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.unitCategoryService.remove(id);
  }
}
