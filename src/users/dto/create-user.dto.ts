import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { Role } from "src/enums/role.enum";

export class CreateUserDto {
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @IsNotEmpty()
    @IsString()
    password: string;

    @IsNotEmpty()
    @IsString()
    confirm_password: string;

    @IsNotEmpty()
    @IsString()
    first_name: string;

    @IsNotEmpty()
    @IsString()
    middle_name: string;
    last_name: string;

    @IsNotEmpty()
    gender: string;

    @IsNotEmpty()
    phone: string;

    @IsOptional()
    address: string;

    @IsEnum(Role)
    roles: Role;

    @IsOptional()
    @IsString()
    profile: string;

    is_active: boolean;
}
