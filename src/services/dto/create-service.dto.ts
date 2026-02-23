import { IsNotEmpty, IsOptional } from "class-validator"

export class CreateServiceDto {
    @IsNotEmpty()
    name: string

    @IsOptional()
    description?: string

    status: boolean
    id: string
}
