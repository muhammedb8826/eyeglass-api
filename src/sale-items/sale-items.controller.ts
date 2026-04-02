import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { SaleItemsService } from './sale-items.service';
import { CreateSaleItemDto } from './dto/create-sale-item.dto';
import { UpdateSaleItemDto } from './dto/update-sale-item.dto';
import { RequirePermissions } from 'src/decorators/permissions.decorator';
import { Permissions } from 'src/permissions/permission.constants';

@Controller('sale-items')
@RequirePermissions(Permissions.SALES_READ)
export class SaleItemsController {
  constructor(private readonly saleItemsService: SaleItemsService) {}

  @Post()
  @RequirePermissions(Permissions.SALES_WRITE)
  create(@Body() createSaleItemDto: CreateSaleItemDto) {
    return this.saleItemsService.create(createSaleItemDto);
  }

  @Get(':saleId')
  findAll(@Param('saleId') saleId: string) {
    return this.saleItemsService.findAll(saleId);
  }

  @Patch(':id')
  @RequirePermissions(Permissions.SALES_WRITE)
  update(@Param('id') id: string, @Body() updateSaleItemDto: UpdateSaleItemDto) {
    return this.saleItemsService.update(id, updateSaleItemDto);
  }

  @Delete(':id')
  @RequirePermissions(Permissions.SALES_WRITE)
  remove(@Param('id') id: string) {
    return this.saleItemsService.remove(id);
  }
}
