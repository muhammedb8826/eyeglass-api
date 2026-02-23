import { PartialType } from '@nestjs/mapped-types';
import { CreateSaleItemNoteDto } from './create-sale-item-note.dto';

export class UpdateSaleItemNoteDto extends PartialType(CreateSaleItemNoteDto) {}
