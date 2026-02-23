import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { OperatorStockService } from './operator-stock.service';
import { CreateOperatorStockDto } from './dto/create-operator-stock.dto';
import { UpdateOperatorStockDto } from './dto/update-operator-stock.dto';

@Controller('operator-stocks')
export class OperatorStockController {
  constructor(private readonly operatorStockService: OperatorStockService) {}

  @Post()
  create(@Body() createOperatorStockDto: CreateOperatorStockDto) {
    return this.operatorStockService.create(createOperatorStockDto);
  }

  @Get()
  findAll(@Query('page') page:number = 1, @Query('limit') limit: number = 10, @Query('search') search?: string) {
    const skip = (page - 1) * limit
    const take = limit
    return this.operatorStockService.findAll(skip, take, search);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.operatorStockService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateOperatorStockDto: UpdateOperatorStockDto) {
    return this.operatorStockService.update(id, updateOperatorStockDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.operatorStockService.remove(id);
  }
}
