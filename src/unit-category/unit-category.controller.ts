import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { UnitCategoryService } from './unit-category.service';
import { CreateUnitCategoryDto } from './dto/create-unit-category.dto';
import { UpdateUnitCategoryDto } from './dto/update-unit-category.dto';
import { RequirePermissions } from 'src/decorators/permissions.decorator';
import { Permissions } from 'src/permissions/permission.constants';

@Controller('unit-category')
@RequirePermissions(Permissions.MASTER_READ)
export class UnitCategoryController {
  constructor(private readonly unitCategoryService: UnitCategoryService) {}

  @Post()
  @RequirePermissions(Permissions.MASTER_WRITE)
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
  @RequirePermissions(Permissions.MASTER_WRITE)
  update(@Param('id') id: string, @Body() updateUnitCategoryDto: UpdateUnitCategoryDto) {
    return this.unitCategoryService.update(id, updateUnitCategoryDto);
  }

  @Delete(':id')
  @RequirePermissions(Permissions.MASTER_WRITE)
  remove(@Param('id') id: string) {
    return this.unitCategoryService.remove(id);
  }
}
