import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID} from "class-validator";

export class CreatePurchaseItemDto {
    id: string;
    itemId: string;

    @IsOptional()
    @IsUUID()
    itemBaseId?: string;

    purchaseId: string;

    uomId: string;

    @IsNumber()
    @IsNotEmpty()
    quantity: number;

    @IsNumber()
    @IsNotEmpty()
    unitPrice: number;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsString()
    status?: string;

    @IsNumber()
    @IsNotEmpty()
    amount: number;

    baseUomId: string;
    unit: number;

    purchaseItemNotes : string[];
}
