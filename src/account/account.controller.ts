import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  BadRequestException,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { AccountService } from './account.service';
import { UpdateAccountDto } from './dto/update-account.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { AtGuard } from '../common';
import { GetCurrentUserId } from '../decorators';

@Controller('account')
@UseGuards(AtGuard)
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Get('me')
  getMe(@GetCurrentUserId() userId: string) {
    return this.accountService.getMe(userId);
  }

  @Patch('me')
  @UseInterceptors(FileInterceptor('profile', {
    storage: diskStorage({
      destination: './uploads/profile',
      filename: (req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname)}`;
        cb(null, uniqueSuffix);
      },
    }),
    fileFilter: (req, file, cb) => {
      const validExtensions = /\.(jpg|jpeg|png|gif|webp|tiff|bmp)$/i;
      if (!file.originalname.match(validExtensions)) {
        return cb(new BadRequestException('Only image files are allowed!'), false);
      }
      cb(null, true);
    },
  }))
  updateMe(
    @GetCurrentUserId() userId: string,
    @Body() updateAccountDto: UpdateAccountDto,
    @UploadedFile() profile?: { filename: string },
  ) {
    if (profile) {
      updateAccountDto.profile = profile.filename;
    }
    return this.accountService.updateMe(userId, updateAccountDto);
  }

  @Patch('password')
  @HttpCode(HttpStatus.OK)
  changePassword(
    @GetCurrentUserId() userId: string,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.accountService.changePassword(userId, changePasswordDto);
  }
}
