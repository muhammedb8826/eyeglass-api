import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { SaleItemNotesService } from './sale-item-notes.service';
import { CreateSaleItemNoteDto } from './dto/create-sale-item-note.dto';
import { UpdateSaleItemNoteDto } from './dto/update-sale-item-note.dto';

@Controller('sale-item-notes')
export class SaleItemNotesController {
  constructor(private readonly saleItemNotesService: SaleItemNotesService) {}

  @Post(':saleItemId')
  create(
    @Param('saleItemId') saleItemId: string,
    @Body() createSaleItemNoteDto: CreateSaleItemNoteDto) {
    return this.saleItemNotesService.create(saleItemId, createSaleItemNoteDto);
  }

  @Get(':saleItemId')
  findAll(@Param('saleItemId') saleItemId: string) {
    return this.saleItemNotesService.findAll(saleItemId);
  }

  @Get('note/:id')
  findOne(@Param('id') id: string) {
    return this.saleItemNotesService.findOne(id);
  }

  @Patch('note/:id')
  update(@Param('id') id: string, @Body() updateSaleItemNoteDto: UpdateSaleItemNoteDto) {
    return this.saleItemNotesService.update(id, updateSaleItemNoteDto);
  }

  @Delete('note/:id')
  remove(@Param('id') id: string) {
    return this.saleItemNotesService.remove(id);
  }
}
