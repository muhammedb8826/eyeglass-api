import {IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from "class-validator";

export class CreateSaleItemDto {
    id: string;
    itemId: string;

    /** Required when the item has base/ADD variants (lens stock per variant). */
    @IsOptional()
    @IsUUID()
    itemBaseId?: string;

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
