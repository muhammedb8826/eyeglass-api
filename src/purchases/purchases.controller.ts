import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { PurchasesService } from './purchases.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { UpdatePurchaseDto } from './dto/update-purchase.dto';
import { RequirePermissions } from 'src/decorators/permissions.decorator';
import { Permissions } from 'src/permissions/permission.constants';

@Controller('purchases')
@RequirePermissions(Permissions.PURCHASES_READ)
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Post()
  @RequirePermissions(Permissions.PURCHASES_WRITE)
  create(@Body() createPurchaseDto: CreatePurchaseDto) {
    return this.purchasesService.create(createPurchaseDto);
  }

  @Get()
  findAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('search') search?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('item1') item1?: string,
    @Query('item2') item2?: string,
    @Query('item3') item3?: string,
  ) {
    const skip = (page - 1) * limit
    const take = limit
    return this.purchasesService.findAll(skip, take, search, startDate, endDate, item1, item2, item3);
  }

  @Get('all')
  findAllPurchases() {
    return this.purchasesService.findAllPurchases();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.purchasesService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions(Permissions.PURCHASES_WRITE)
  update(@Param('id') id: string, @Body() updatePurchaseDto: UpdatePurchaseDto) {
    return this.purchasesService.update(id, updatePurchaseDto);
  }

  @Delete(':id')
  @RequirePermissions(Permissions.PURCHASES_WRITE)
  remove(@Param('id') id: string) {
    return this.purchasesService.remove(id);
  }
}
