import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { LabToolService } from './lab-tool.service';
import { CreateLabToolDto } from './dto/create-lab-tool.dto';
import { UpdateLabToolDto } from './dto/update-lab-tool.dto';

@Controller('lab-tools')
export class LabToolController {
  constructor(private readonly labToolService: LabToolService) {}

  @Post()
  create(@Body() createLabToolDto: CreateLabToolDto) {
    return this.labToolService.create(createLabToolDto);
  }

  @Get()
  findAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 50,
  ) {
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);
    return this.labToolService.findAll(skip, take);
  }

  @Get('check')
  checkAvailability(@Query('baseCurves') baseCurves: string) {
    const values = (baseCurves || '')
      .split(',')
      .map(s => parseFloat(s.trim()))
      .filter(n => !Number.isNaN(n));
    return this.labToolService.checkAvailabilityForBaseCurves(values);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.labToolService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateLabToolDto: UpdateLabToolDto) {
    return this.labToolService.update(id, updateLabToolDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.labToolService.remove(id);
  }
}
