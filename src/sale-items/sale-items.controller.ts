import { Controller, Get, Post, Body, Patch, Param, Delete, Req } from '@nestjs/common';
import { Request } from 'express';
import { SaleItemsService } from './sale-items.service';
import { CreateSaleItemDto } from './dto/create-sale-item.dto';
import { UpdateSaleItemDto } from './dto/update-sale-item.dto';
import { RequirePermissions } from 'src/decorators/permissions.decorator';
import { Permissions } from 'src/permissions/permission.constants';
import { User } from 'src/entities/user.entity';

@Controller('sale-items')
@RequirePermissions(Permissions.SALES_READ)
export class SaleItemsController {
  constructor(private readonly saleItemsService: SaleItemsService) {}

  @Post()
  @RequirePermissions(Permissions.SALES_WRITE)
  create(
    @Body() createSaleItemDto: CreateSaleItemDto,
    @Req() req: Request,
  ) {
    return this.saleItemsService.create(
      createSaleItemDto,
      req.user as User,
    );
  }

  @Get(':saleId')
  findAll(@Param('saleId') saleId: string) {
    return this.saleItemsService.findAll(saleId);
  }

  @Patch(':id')
  @RequirePermissions(Permissions.SALES_WRITE)
  update(
    @Param('id') id: string,
    @Body() updateSaleItemDto: UpdateSaleItemDto,
    @Req() req: Request,
  ) {
    return this.saleItemsService.update(
      id,
      updateSaleItemDto,
      req.user as User,
    );
  }

  @Delete(':id')
  @RequirePermissions(Permissions.SALES_WRITE)
  remove(@Param('id') id: string, @Req() req: Request) {
    return this.saleItemsService.remove(id, req.user as User);
  }
}
