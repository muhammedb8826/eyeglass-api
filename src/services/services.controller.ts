import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { RequirePermissions } from 'src/decorators/permissions.decorator';
import { Permissions } from 'src/permissions/permission.constants';

@Controller('services')
@RequirePermissions(Permissions.MASTER_READ)
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Post()
  @RequirePermissions(Permissions.MASTER_WRITE)
  create(@Body() createServiceDto: CreateServiceDto) {
    return this.servicesService.create(createServiceDto);
  }

  @Get()
  findAll(@Query('page') page:number = 1, @Query('limit') limit: number = 10) {
    const skip = (page - 1) * limit
    const take = limit
    return this.servicesService.findAll(skip, take);
  }

  @Get('all')
  findAllServices() {
    return this.servicesService.findAllServices();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.servicesService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions(Permissions.MASTER_WRITE)
  update(@Param('id') id: string, @Body() updateServiceDto: UpdateServiceDto) {
    return this.servicesService.update(id, updateServiceDto);
  }

  @Delete(':id')
  @RequirePermissions(Permissions.MASTER_WRITE)
  remove(@Param('id') id: string) {
    return this.servicesService.remove(id);
  }
}
