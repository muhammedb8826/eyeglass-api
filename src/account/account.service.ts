import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { UpdateAccountDto } from './dto/update-account.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AccountService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async getMe(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.sanitizeUser(user);
  }

  async updateMe(userId: string, updateAccountDto: UpdateAccountDto) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (updateAccountDto.email && updateAccountDto.email !== user.email) {
      const existingUser = await this.userRepository.findOne({
        where: { email: updateAccountDto.email },
      });
      if (existingUser && existingUser.id !== userId) {
        throw new ForbiddenException('Email already in use');
      }
    }

    if (updateAccountDto.phone && updateAccountDto.phone !== user.phone) {
      const existingUser = await this.userRepository.findOne({
        where: { phone: updateAccountDto.phone },
      });
      if (existingUser && existingUser.id !== userId) {
        throw new ForbiddenException('Phone number already in use');
      }
    }

    const updateData = Object.fromEntries(
      Object.entries(updateAccountDto).filter(([, v]) => v !== undefined),
    ) as Partial<UpdateAccountDto & { profile?: string }>;
    if (updateData.profile) {
      updateData.profile = `/uploads/profile/${updateData.profile}`;
    }
    await this.userRepository.update(userId, updateData);
    const updatedUser = await this.userRepository.findOne({
      where: { id: userId },
    });
    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }
    return this.sanitizeUser(updatedUser);
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const passwordMatches = await bcrypt.compare(
      changePasswordDto.currentPassword,
      user.password,
    );
    if (!passwordMatches) {
      throw new ForbiddenException('Current password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(changePasswordDto.newPassword, 10);
    await this.userRepository.update(userId, {
      password: hashedPassword,
      confirm_password: hashedPassword,
    });

    return { message: 'Password updated successfully' };
  }

  private sanitizeUser(user: User) {
    const { password, confirm_password, passwordRT, ...sanitized } = user;
    const profile = user.profile
      ? user.profile.startsWith('/')
        ? user.profile
        : `/uploads/profile/${user.profile}`
      : null;
    return { ...sanitized, profile };
  }
}
