import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';
import { Role } from 'src/enums/role.enum';

export class UpdateUserDto extends PartialType(CreateUserDto) {
    email: string;
    password: string;
    confirm_password: string;
    first_name: string;
    middle_name: string;
    last_name: string
    gender?: string;
    phone?: string;
    address?: string;
    roles?: Role;
    profile?: string;
    isActive?: boolean;
}
