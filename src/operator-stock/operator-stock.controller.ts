import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { OperatorStockService } from './operator-stock.service';
import { CreateOperatorStockDto } from './dto/create-operator-stock.dto';
import { UpdateOperatorStockDto } from './dto/update-operator-stock.dto';
import { RequirePermissions } from 'src/decorators/permissions.decorator';
import { Permissions } from 'src/permissions/permission.constants';

@Controller('operator-stocks')
@RequirePermissions(Permissions.STOCK_OPS_READ)
export class OperatorStockController {
  constructor(private readonly operatorStockService: OperatorStockService) {}

  @Post()
  @RequirePermissions(Permissions.STOCK_OPS_WRITE)
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
  @RequirePermissions(Permissions.STOCK_OPS_WRITE)
  update(@Param('id') id: string, @Body() updateOperatorStockDto: UpdateOperatorStockDto) {
    return this.operatorStockService.update(id, updateOperatorStockDto);
  }

  @Delete(':id')
  @RequirePermissions(Permissions.STOCK_OPS_WRITE)
  remove(@Param('id') id: string) {
    return this.operatorStockService.remove(id);
  }
}
