import { PartialType } from '@nestjs/mapped-types';
import { CreateItemDto } from './create-item.dto';
import { IsInt, IsBoolean, IsOptional } from 'class-validator';

export class UpdateItemDto extends PartialType(CreateItemDto) {
    @IsInt()
    reorder_level: number;

    @IsInt()
    initial_stock: number;

    @IsInt()
    updated_initial_stock: number;

    @IsOptional()
    @IsBoolean()
    can_be_sold?: boolean;

    @IsOptional()
    @IsBoolean()
    can_be_purchased?: boolean;

    purchaseUnitOfMeasureId?: string;
    unitOfMeasureId?: string;
    purchase_price?: number;
    selling_price?: number;
}
