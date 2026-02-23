import { IsNotEmpty, IsOptional } from "class-validator";

export class CreateCustomerDto {
    @IsNotEmpty()
    fullName: string;
    
    @IsOptional()
    email?: string;

    @IsNotEmpty()
    phone: string;

    @IsOptional()
    company?: string;

    @IsOptional()
    address?: string;

    @IsOptional()
    description?: string;
}
