import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { UomService } from './uom.service';
import { CreateUomDto } from './dto/create-uom.dto';
import { UpdateUomDto } from './dto/update-uom.dto';
import { RequirePermissions } from 'src/decorators/permissions.decorator';
import { Permissions } from 'src/permissions/permission.constants';

@Controller('uom')
@RequirePermissions(Permissions.MASTER_READ)
export class UomController {
  constructor(private readonly uomService: UomService) {}

  @Post()
  @RequirePermissions(Permissions.MASTER_WRITE)
  create(@Body() createUomDto: CreateUomDto) {
    return this.uomService.create(createUomDto);
  }

  @Get()
  findAll(@Query('categoryId') categoryId?: string) {
    return this.uomService.findAll(categoryId);
  }

  @Get('all')
  findAllUoms() {
    return this.uomService.findAllUoms();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.uomService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions(Permissions.MASTER_WRITE)
  update(@Param('id') id: string, @Body() updateUomDto: UpdateUomDto) {
    return this.uomService.update(id, updateUomDto);
  }

  @Delete(':id')
  @RequirePermissions(Permissions.MASTER_WRITE)
  remove(@Param('id') id: string) {
    return this.uomService.remove(id);
  }
}
