import { Module } from '@nestjs/common';
import { FixedCostService } from './fixed-cost.service';
import { FixedCostController } from './fixed-cost.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FixedCost } from 'src/entities/fixed-cost.entity';

@Module({
  imports: [TypeOrmModule.forFeature([FixedCost])],
  controllers: [FixedCostController],
  providers: [FixedCostService],
})
export class FixedCostModule {}
