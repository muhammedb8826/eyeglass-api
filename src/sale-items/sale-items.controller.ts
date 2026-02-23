import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { SaleItemsService } from './sale-items.service';
import { CreateSaleItemDto } from './dto/create-sale-item.dto';
import { UpdateSaleItemDto } from './dto/update-sale-item.dto';

@Controller('sale-items')
export class SaleItemsController {
  constructor(private readonly saleItemsService: SaleItemsService) {}

  @Post()
  create(@Body() createSaleItemDto: CreateSaleItemDto) {
    return this.saleItemsService.create(createSaleItemDto);
  }

  @Get(':saleId')
  findAll(@Param('saleId') saleId: string) {
    return this.saleItemsService.findAll(saleId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateSaleItemDto: UpdateSaleItemDto) {
    return this.saleItemsService.update(id, updateSaleItemDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.saleItemsService.remove(id);
  }
}
