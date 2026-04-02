import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { BomService } from './bom.service';
import { CreateBomDto } from './dto/create-bom.dto';
import { UpdateBomDto } from './dto/update-bom.dto';
import { RequirePermissions } from 'src/decorators/permissions.decorator';
import { Permissions } from 'src/permissions/permission.constants';

@Controller('boms')
@RequirePermissions(Permissions.BOM_READ)
export class BomController {
  constructor(private readonly bomService: BomService) {}

  @Post()
  @RequirePermissions(Permissions.BOM_WRITE)
  create(@Body() dto: CreateBomDto) {
    return this.bomService.create(dto);
  }

  @Get()
  findAll(@Query('parentItemId') parentItemId?: string) {
    return this.bomService.findAll(parentItemId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.bomService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions(Permissions.BOM_WRITE)
  update(@Param('id') id: string, @Body() dto: UpdateBomDto) {
    return this.bomService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permissions.BOM_WRITE)
  remove(@Param('id') id: string) {
    return this.bomService.remove(id);
  }
}

