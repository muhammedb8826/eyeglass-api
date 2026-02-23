import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { MachinesService } from './machines.service';
import { CreateMachineDto } from './dto/create-machine.dto';
import { UpdateMachineDto } from './dto/update-machine.dto';

@Controller('machines')
export class MachinesController {
  constructor(private readonly machinesService: MachinesService) {}

  @Post()
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
  update(@Param('id') id: string, @Body() updateMachineDto: UpdateMachineDto) {
    return this.machinesService.update(id, updateMachineDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.machinesService.remove(id);
  }
}
