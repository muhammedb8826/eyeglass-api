import { Controller, Get, Param, Query } from '@nestjs/common';
import { BincardService } from './bincard.service';

@Controller('bincard')
export class BincardController {
  constructor(private readonly bincardService: BincardService) {}

  @Get('item/:itemId')
  findByItemId(
    @Param('itemId') itemId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 50,
  ) {
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);
    return this.bincardService.findByItemId(itemId, skip, take);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.bincardService.findOne(id);
  }
}
