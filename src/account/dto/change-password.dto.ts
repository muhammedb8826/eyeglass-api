import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(6, { message: 'Current password is required' })
  currentPassword: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(6, { message: 'New password must be at least 6 characters' })
  newPassword: string;
}
