import { IsNotEmpty, IsOptional } from "class-validator";

export class CreateVendorDto {
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
    reference?: string;

    @IsOptional()
    description?: string;
}
