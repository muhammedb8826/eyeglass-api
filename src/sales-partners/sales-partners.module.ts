import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalesPartnersService } from './sales-partners.service';
import { SalesPartnersController } from './sales-partners.controller';
import { SalesPartner } from 'src/entities/sales-partner.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SalesPartner])],
  controllers: [SalesPartnersController],
  providers: [SalesPartnersService],
})
export class SalesPartnersModule {}
