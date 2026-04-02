import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { MachinesService } from './machines.service';
import { CreateMachineDto } from './dto/create-machine.dto';
import { UpdateMachineDto } from './dto/update-machine.dto';
import { RequirePermissions } from 'src/decorators/permissions.decorator';
import { Permissions } from 'src/permissions/permission.constants';

@Controller('machines')
@RequirePermissions(Permissions.MASTER_READ)
export class MachinesController {
  constructor(private readonly machinesService: MachinesService) {}

  @Post()
  @RequirePermissions(Permissions.MASTER_WRITE)
  create(@Body() createMachineDto: CreateMachineDto) {
    return this.machinesService.create(createMachineDto);
  }

  @Get()
  findAll(@Query('page') page:number = 1, @Query('limit') limit: number = 10) {
    const skip = (page - 1) * limit
    const take = limit
    return this.machinesService.findAll(skip, take);
  }

  @Get('all')
  findAllMachines() {
    return this.machinesService.findAllMachines();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.machinesService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions(Permissions.MASTER_WRITE)
  update(@Param('id') id: string, @Body() updateMachineDto: UpdateMachineDto) {
    return this.machinesService.update(id, updateMachineDto);
  }

  @Delete(':id')
  @RequirePermissions(Permissions.MASTER_WRITE)
  remove(@Param('id') id: string) {
    return this.machinesService.remove(id);
  }
}
