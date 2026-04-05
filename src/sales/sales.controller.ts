import { Controller, Get, Post, Body, Patch, Param, Delete, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { RequirePermissions } from 'src/decorators/permissions.decorator';
import { Permissions } from 'src/permissions/permission.constants';
import { User } from 'src/entities/user.entity';

@Controller('sales')
@RequirePermissions(Permissions.SALES_READ)
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  @RequirePermissions(Permissions.SALES_WRITE)
  create(
    @Body() createSaleDto: CreateSaleDto,
    @Req() req: Request,
  ) {
    return this.salesService.create(
      createSaleDto,
      req.user as User | undefined,
    );
  }

  @Get()
  findAll(@Query('page') page:number = 1, @Query('limit') limit: number = 10) {
    const skip = (page - 1) * limit
    const take = limit
    return this.salesService.findAll(skip, take);
  }

  @Get('all')
  findAllSales() {
    return this.salesService.findAllSales();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.salesService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions(Permissions.SALES_WRITE)
  update(
    @Param('id') id: string,
    @Body() updateSaleDto: UpdateSaleDto,
    @Req() req: Request,
  ) {
    return this.salesService.update(
      id,
      updateSaleDto,
      req.user as User,
    );
  }

  @Delete(':id')
  @RequirePermissions(Permissions.SALES_WRITE)
  remove(@Param('id') id: string) {
    return this.salesService.remove(id);
  }
}
