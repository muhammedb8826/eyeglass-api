import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { FixedCostService } from './fixed-cost.service';
import { CreateFixedCostDto } from './dto/create-fixed-cost.dto';
import { UpdateFixedCostDto } from './dto/update-fixed-cost.dto';
import { RequirePermissions } from 'src/decorators/permissions.decorator';
import { Permissions } from 'src/permissions/permission.constants';

@Controller('fixed-cost')
@RequirePermissions(Permissions.FINANCE_READ)
export class FixedCostController {
  constructor(private readonly fixedCostService: FixedCostService) {}

  @Post()
  @RequirePermissions(Permissions.FINANCE_WRITE)
  create(@Body() createFixedCostDto: CreateFixedCostDto) {
    return this.fixedCostService.create(createFixedCostDto);
  }

  @Get()
  findAll(@Query('page') page:number = 1, @Query('limit') limit: number = 10) {
    const skip = (page - 1) * limit
    const take = limit
    return this.fixedCostService.findAll(skip, take);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.fixedCostService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions(Permissions.FINANCE_WRITE)
  update(@Param('id') id: string, @Body() updateFixedCostDto: UpdateFixedCostDto) {
    return this.fixedCostService.update(id, updateFixedCostDto);
  }

  @Delete(':id')
  @RequirePermissions(Permissions.FINANCE_WRITE)
  remove(@Param('id') id: string) {
    return this.fixedCostService.remove(id);
  }
}
