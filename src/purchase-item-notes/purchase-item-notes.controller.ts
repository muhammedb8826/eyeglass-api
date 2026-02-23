import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { PurchaseItemNotesService } from './purchase-item-notes.service';
import { CreatePurchaseItemNoteDto } from './dto/create-purchase-item-note.dto';
import { UpdatePurchaseItemNoteDto } from './dto/update-purchase-item-note.dto';

@Controller('purchase-item-notes')
export class PurchaseItemNotesController {
  constructor(private readonly purchaseItemNotesService: PurchaseItemNotesService) {}

  @Post(':purchaseItemId')
  async create(
    @Param('purchaseItemId') purchaseItemId: string,
    @Body() createPurchaseItemNoteDto: CreatePurchaseItemNoteDto
  ) {
    return this.purchaseItemNotesService.create(purchaseItemId, createPurchaseItemNoteDto);
  }

  @Get(':purchaseItemId')
  findAll(@Param('purchaseItemId') purchaseItemId: string) {
    return this.purchaseItemNotesService.findAll(purchaseItemId);
  }

  @Get('note/:id')
  findOne(@Param('id') id: string) {
    return this.purchaseItemNotesService.findOne(id);
  }

  @Patch('note/:id')
  update(@Param('id') id: string, @Body() updatePurchaseItemNoteDto: UpdatePurchaseItemNoteDto) {
    return this.purchaseItemNotesService.update(id, updatePurchaseItemNoteDto);
  }

  @Delete('note/:id')
  remove(@Param('id') id: string) {
    return this.purchaseItemNotesService.remove(id);
  }
}
