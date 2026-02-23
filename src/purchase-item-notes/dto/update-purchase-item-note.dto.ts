import { PartialType } from '@nestjs/mapped-types';
import { CreatePurchaseItemNoteDto } from './create-purchase-item-note.dto';

export class UpdatePurchaseItemNoteDto extends PartialType(CreatePurchaseItemNoteDto) {}
