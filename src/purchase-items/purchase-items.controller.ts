import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { PurchaseItemsService } from './purchase-items.service';
import { CreatePurchaseItemDto } from './dto/create-purchase-item.dto';
import { UpdatePurchaseItemDto } from './dto/update-purchase-item.dto';

@Controller('purchase-items')
export class PurchaseItemsController {
  constructor(private readonly purchaseItemsService: PurchaseItemsService) {}

  @Post()
 async create(@Body() createPurchaseItemDto: CreatePurchaseItemDto) {
    return this.purchaseItemsService.create(createPurchaseItemDto);
  }

  @Get('all')
  async findAllPurchaseItems(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('search') search?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('item') item?: string,
    @Query('status') status?: string,
  ) {
    const skip = (page - 1) * limit
    const take = limit
    return this.purchaseItemsService.findAllPurchaseItems(skip, take, search, startDate, endDate, item, status);
  }

  @Get(':purchaseId')
  async findAll(@Param('purchaseId') purchaseId: string) {
    return this.purchaseItemsService.findAll(purchaseId);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updatePurchaseItemDto: UpdatePurchaseItemDto) {
    return this.purchaseItemsService.update(id, updatePurchaseItemDto);
  }

  @Delete(':id')
 async remove(@Param('id') id: string) {
    return this.purchaseItemsService.remove(id);
  }
}
