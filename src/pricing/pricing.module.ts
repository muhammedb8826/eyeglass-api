import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PricingService } from './pricing.service';
import { PricingController } from './pricing.controller';
import { Pricing } from 'src/entities/pricing.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Pricing])],
  controllers: [PricingController],
  providers: [PricingService],
})

export class PricingModule {}