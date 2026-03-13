import { PartialType } from '@nestjs/mapped-types';
import { CreateOrderItemDto } from './create-order-item.dto';

export class UpdateOrderItemDto extends PartialType(CreateOrderItemDto) {
  // Used when auto-creating store requests (Sale/SaleItems) from an order item.
  operatorId?: string;
}
