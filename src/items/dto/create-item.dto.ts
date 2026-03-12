import { IsBoolean, IsInt, IsOptional, IsString } from "class-validator";

export class CreateItemDto {
    @IsOptional()
    @IsString()
    itemCode?: string;

    @IsString()
    name: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsInt()
    reorder_level: number;

    @IsBoolean()
    can_be_sold: boolean;

    @IsBoolean()
    can_be_purchased: boolean;

    @IsOptional()
    @IsString()
    defaultUomId?: string;
   
    @IsOptional()
    @IsString()
    purchaseUomId?: string;

    quantity: number;

    unitCategoryId?: string;
}
