import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { PurchaseItemNotesService } from './purchase-item-notes.service';
import { CreatePurchaseItemNoteDto } from './dto/create-purchase-item-note.dto';
import { UpdatePurchaseItemNoteDto } from './dto/update-purchase-item-note.dto';
import { RequirePermissions } from 'src/decorators/permissions.decorator';
import { Permissions } from 'src/permissions/permission.constants';

@Controller('purchase-item-notes')
@RequirePermissions(Permissions.PURCHASES_READ)
export class PurchaseItemNotesController {
  constructor(private readonly purchaseItemNotesService: PurchaseItemNotesService) {}

  @Post(':purchaseItemId')
  @RequirePermissions(Permissions.PURCHASES_WRITE)
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
  @RequirePermissions(Permissions.PURCHASES_WRITE)
  update(@Param('id') id: string, @Body() updatePurchaseItemNoteDto: UpdatePurchaseItemNoteDto) {
    return this.purchaseItemNotesService.update(id, updatePurchaseItemNoteDto);
  }

  @Delete('note/:id')
  @RequirePermissions(Permissions.PURCHASES_WRITE)
  remove(@Param('id') id: string) {
    return this.purchaseItemNotesService.remove(id);
  }
}
