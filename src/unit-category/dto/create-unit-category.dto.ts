import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateUnitCategoryDto {
    @IsNotEmpty()
    @IsString()
    name: string;

    @IsOptional()
    description?: string

    constant: boolean

    constantValue: number

}
