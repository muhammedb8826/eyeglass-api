import { Controller, Get, Param, Query } from '@nestjs/common';
import { BincardService } from './bincard.service';
import { RequirePermissions } from 'src/decorators/permissions.decorator';
import { Permissions } from 'src/permissions/permission.constants';

@Controller('bincard')
@RequirePermissions(Permissions.BINCARD_READ)
export class BincardController {
  constructor(private readonly bincardService: BincardService) {}

  @Get('item/:itemId')
  findByItemId(
    @Param('itemId') itemId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 50,
    /** Optional: UUID = that variant only; `null` or `none` = rows with no variant (parent-level) only */
    @Query('itemBaseId') itemBaseId?: string,
  ) {
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);
    const raw = itemBaseId?.trim();
    const filter =
      raw === undefined || raw === ''
        ? undefined
        : raw.toLowerCase() === 'null' || raw.toLowerCase() === 'none'
          ? { itemBaseId: null }
          : { itemBaseId: raw };
    return this.bincardService.findByItemId(itemId, skip, take, filter);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.bincardService.findOne(id);
  }
}
