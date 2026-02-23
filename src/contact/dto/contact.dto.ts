import { IsString, IsEmail, IsOptional, IsNotEmpty } from 'class-validator';

export class ContactDto {
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsOptional()
  company?: string;

  @IsString()
  @IsNotEmpty()
  serviceType: string;

  @IsString()
  @IsNotEmpty()
  projectDetails: string;
}
