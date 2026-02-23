import { IsNotEmpty, IsOptional } from "class-validator";

export class CreateMachineDto {
    @IsNotEmpty()
    name: string

    @IsOptional()
    description: string

    status: boolean
}
