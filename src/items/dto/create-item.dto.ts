import { IsBoolean, IsInt, IsOptional, IsString } from "class-validator";

export class CreateItemDto {
    @IsString()
    name: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsInt()
    reorder_level: number;

    @IsInt()
    initial_stock: number;

    @IsInt()
    updated_initial_stock: number;

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

    @IsString()
    machineId: string;

    quantity: number;

    unitCategoryId?: string;
}
