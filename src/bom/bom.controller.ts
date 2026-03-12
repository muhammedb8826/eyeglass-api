import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { BomService } from './bom.service';
import { CreateBomDto } from './dto/create-bom.dto';
import { UpdateBomDto } from './dto/update-bom.dto';

@Controller('boms')
export class BomController {
  constructor(private readonly bomService: BomService) {}

  @Post()
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
  update(@Param('id') id: string, @Body() dto: UpdateBomDto) {
    return this.bomService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.bomService.remove(id);
  }
}

