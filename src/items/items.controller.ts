import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ItemsService } from './items.service';
import { CreateItemDto } from './dto/create-item.dto';
import { CreateItemBaseDto } from './dto/create-item-base.dto';
import { UpdateItemBaseDto } from './dto/update-item-base.dto';
import { UpdateItemDto } from './dto/update-item.dto';

@Controller('items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Post()
  create(@Body() createItemDto: CreateItemDto) {
    return this.itemsService.create(createItemDto);
  }

  @Get()
  findAll(@Query('page') page:number = 1, @Query('limit') limit: number = 10, @Query('search') search?: string) {
    const skip = (page - 1) * limit
    const take = limit
    return this.itemsService.findAll(skip, take, search);
  }

  @Get('all')
  findAllItems() {
    return this.itemsService.findAllItems();
  }

  @Get(':id/bases')
  findBases(@Param('id') id: string) {
    return this.itemsService.findBasesByItemId(id);
  }

  @Post(':id/bases')
  addBase(@Param('id') id: string, @Body() createItemBaseDto: CreateItemBaseDto) {
    return this.itemsService.addBase(id, createItemBaseDto);
  }

  @Patch(':id/bases/:baseId')
  updateBase(
    @Param('id') id: string,
    @Param('baseId') baseId: string,
    @Body() updateItemBaseDto: UpdateItemBaseDto,
  ) {
    return this.itemsService.updateBase(id, baseId, updateItemBaseDto);
  }

  @Delete(':id/bases/:baseId')
  removeBase(@Param('id') id: string, @Param('baseId') baseId: string) {
    return this.itemsService.deleteBase(id, baseId);
  }

  /** Pricing and tool (machine) for this item when creating an order line. Optional ?itemBaseId= for base variant. */
  @Get(':id/order-info')
  getOrderInfo(@Param('id') id: string, @Query('itemBaseId') itemBaseId?: string) {
    return this.itemsService.getOrderInfo(id, itemBaseId ?? null);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.itemsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateItemDto: UpdateItemDto) {
    return this.itemsService.update(id, updateItemDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.itemsService.remove(id);
  }
}
