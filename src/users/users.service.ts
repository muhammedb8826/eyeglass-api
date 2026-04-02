import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from 'src/entities/user.entity';
import { Role } from 'src/enums/role.enum';
import * as bcrypt from 'bcrypt';
import { NotificationsService } from 'src/notifications/notifications.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private readonly notificationsService: NotificationsService,
  ) { }

  async create(createUserDto: CreateUserDto) {
    if (createUserDto.password !== createUserDto.confirm_password) {
      throw new ForbiddenException('Passwords do not match');
    }

    await this.checkForExistingUser(createUserDto.email, createUserDto.phone);

    const hashedPassword = await this.hashPassword(createUserDto.password);
    const isActive = Boolean(createUserDto.is_active);

    const user = this.userRepository.create({
      email: createUserDto.email,
      password: hashedPassword,
      confirm_password: hashedPassword,
      is_active: isActive,
      profile: createUserDto.profile ? `/uploads/profile/${createUserDto.profile}` : null,
      first_name: createUserDto.first_name,
      last_name: createUserDto.last_name,
      middle_name: createUserDto.middle_name,
      gender: createUserDto.gender,
      phone: createUserDto.phone,
      address: createUserDto.address,
      roles: createUserDto.roles as Role,
    });

    return this.userRepository.save(user);
  }

  async findAll(skip: number, take: number) {
    const [users, total] = await this.userRepository.findAndCount({
      skip: Number(skip),
      take: Number(take),
      order: {
        createdAt: 'DESC'
      }
    });
    return {
      users,
      total
    }
  }

  async findAllUsers(): Promise<User[]> {
    const users = await this.userRepository.find();
    users.forEach(user => {
      user.profile = user.profile ? `/uploads/profile/${user.profile}` : null;
    });
    return users;
  }

  async getUserByRole(role: Role): Promise<User[]> {
    const users = await this.userRepository.find({
      where: { roles: role },
    });
    users.forEach(user => {
      user.profile = user.profile ? `/uploads/profile/${user.profile}` : null;
    });
    return users;
  }

  async findOne(id: string) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User with ID ${id} not found`);
    return {
      ...user,
      profile: user.profile ? `/uploads/profile/${user.profile}` : null,
    };
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User with ID ${id} not found`);

    const updateData: any = { ...updateUserDto };
    const requestedIsActive =
      updateUserDto.is_active !== undefined
        ? Boolean(updateUserDto.is_active)
        : updateUserDto.isActive !== undefined
          ? Boolean(updateUserDto.isActive)
          : undefined;
    if (requestedIsActive === false && user.roles === Role.ADMIN) {
      throw new ForbiddenException('Admin account cannot be deactivated.');
    }
    if (requestedIsActive !== undefined) {
      updateData.is_active = requestedIsActive;
    }
    if (updateUserDto.profile) {
      updateData.profile = `/uploads/profile/${updateUserDto.profile}`;
    }

    await this.userRepository.update(id, updateData);

    return this.userRepository.findOne({ where: { id } });
  }

  async remove(id: string) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User with ID ${id} not found`);
    if (user.roles === Role.ADMIN) {
      throw new ForbiddenException('Admin account cannot be deleted.');
    }
    return this.userRepository.remove(user);
  }

  async setActiveStatus(id: string, isActive: boolean) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User with ID ${id} not found`);
    if (user.roles === Role.ADMIN) {
      throw new ForbiddenException('Admin account cannot be activated/deactivated.');
    }
    await this.userRepository.update(id, { is_active: isActive });
    await this.notificationsService.notify({
      recipientId: id,
      type: 'SECURITY',
      title: isActive ? 'Account activated' : 'Account deactivated',
      message: isActive
        ? 'Your account has been activated. You can sign in now.'
        : 'Your account has been deactivated. Please contact an administrator.',
      data: { is_active: isActive },
    });
    return this.userRepository.findOne({ where: { id } });
  }

  async resetPassword(userId: string, newPassword: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User with ID ${userId} not found`);

    const hashedPassword = await this.hashPassword(newPassword);
    await this.userRepository.update(userId, {
      password: hashedPassword,
      confirm_password: hashedPassword,
    });

    return { message: 'Password reset successfully' };
  }

  async hashPassword(password: string) {
    return await bcrypt.hash(password, 10);
  }

  private async checkForExistingUser(email: string, phone: string) {
    const [existingEmailUser, existingPhoneUser] = await Promise.all([
      this.userRepository.findOne({ where: { email } }),
      this.userRepository.findOne({ where: { phone } }),
    ]);

    if (existingEmailUser) {
      throw new ConflictException('Email already exists');
    }

    if (existingPhoneUser) {
      throw new ConflictException('Phone number already exists');
    }
  }
}
