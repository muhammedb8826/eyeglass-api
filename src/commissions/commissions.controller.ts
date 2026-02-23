import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { CommissionsService } from './commissions.service';
import { CreateCommissionDto } from './dto/create-commission.dto';
import { UpdateCommissionDto } from './dto/update-commission.dto';

@Controller('commissions')
export class CommissionsController {
  constructor(private readonly commissionsService: CommissionsService) {}

  @Post()
  create(@Body() createCommissionDto: CreateCommissionDto) {
    return this.commissionsService.create(createCommissionDto);
  }

  @Get()
  findAll(@Query('page') page:number = 1, @Query('limit') limit: number = 10) {
    const skip = (page - 1) * limit
    const take = limit
    return this.commissionsService.findAll(skip, take);
  }

@Get('all')
  findAllCommissions() {
    return this.commissionsService.findAllCommissions();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.commissionsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCommissionDto: UpdateCommissionDto) {
    return this.commissionsService.update(id, updateCommissionDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.commissionsService.remove(id);
  }
}
