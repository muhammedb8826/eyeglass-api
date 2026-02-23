import {IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";

export class CreateSaleItemDto {
    id: string;
    itemId: string;

    saleId: string;
    uomId: string;

    @IsNumber()
    @IsNotEmpty()
    quantity: number;
    
    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsString()
    status?: string;

    baseUomId: string;
    unit: number;
    
    saleItemNotes: string[];
}
