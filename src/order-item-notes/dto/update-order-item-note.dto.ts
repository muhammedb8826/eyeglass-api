import { PartialType } from '@nestjs/mapped-types';
import { CreateOrderItemNoteDto } from './create-order-item-note.dto';

export class UpdateOrderItemNoteDto extends PartialType(CreateOrderItemNoteDto) {}
