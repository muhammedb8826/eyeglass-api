import { PartialType } from '@nestjs/mapped-types';
import { CreateOperatorStockDto } from './create-operator-stock.dto';

export class UpdateOperatorStockDto extends PartialType(CreateOperatorStockDto) {}
