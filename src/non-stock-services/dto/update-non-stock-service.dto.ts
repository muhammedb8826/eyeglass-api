import { PartialType } from '@nestjs/mapped-types';
import { CreateNonStockServiceDto } from './create-non-stock-service.dto';

export class UpdateNonStockServiceDto extends PartialType(CreateNonStockServiceDto) {}
