import { IsNotEmpty, IsOptional } from "class-validator"

export class CreateNonStockServiceDto {
    @IsNotEmpty()
    name: string

    @IsOptional()
    description?: string

    status: boolean
    id: string
}
