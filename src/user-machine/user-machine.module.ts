import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserMachineService } from './user-machine.service';
import { UserMachineController } from './user-machine.controller';
import { UserMachine } from 'src/entities/user-machine.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserMachine])],
  providers: [UserMachineService],
  controllers: [UserMachineController],
  exports: [UserMachineService],
})
export class UserMachineModule {} 