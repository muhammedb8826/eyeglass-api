import { IsNumber, IsString, IsOptional, IsBoolean } from "class-validator";

export class CreatePricingDto {
    @IsString()
    itemId: string;

    // Optional: price per specific base variant (eyeglass)
    @IsOptional()
    @IsString()
    itemBaseId?: string;

    @IsOptional()
    @IsString()
    serviceId?: string;

    @IsOptional()
    @IsString()
    nonStockServiceId?: string;

    @IsOptional()
    @IsBoolean()
    isNonStockService?: boolean;

    @IsNumber()
    sellingPrice: number;

    @IsNumber()
    costPrice: number;
    baseUomId: string;
}
