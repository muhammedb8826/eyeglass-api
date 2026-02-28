import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bincard } from 'src/entities/bincard.entity';
import { BincardService } from './bincard.service';
import { BincardController } from './bincard.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Bincard])],
  controllers: [BincardController],
  providers: [BincardService],
  exports: [BincardService],
})
export class BincardModule {}
