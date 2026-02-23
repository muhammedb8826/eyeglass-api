import { IsEmail, IsNotEmpty, IsString } from "class-validator";

export class AuthDto {
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @IsNotEmpty()
    @IsString()
    password: string;

    confirm_password: string;
    phone: string;
    address: string;
}