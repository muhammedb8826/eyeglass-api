import { IsNotEmpty, IsOptional, IsString } from "class-validator";
import { CreateSaleItemDto } from "src/sale-items/dto/create-sale-item.dto";

export class CreateSaleDto {
    id: string;
    @IsString()
    @IsNotEmpty()
    series: string;

    @IsString()
    @IsNotEmpty()
    operatorId: string;

    @IsString()
    @IsNotEmpty()
    status: string;

    orderDate: Date;

    @IsOptional()
    @IsString()
    reference?: string;

    totalQuantity: number;
    note: string;

    saleItems: CreateSaleItemDto[];

}
