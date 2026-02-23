import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [AccountController],
  providers: [AccountService],
  exports: [AccountService],
})
export class AccountModule {}
