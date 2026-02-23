import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AtStrategy, RtStrategy } from './strategy';
import { JwtModule } from '@nestjs/jwt';
import { User } from 'src/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    JwtModule.register({})
  ],
  providers: [AuthService, AtStrategy, RtStrategy],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
