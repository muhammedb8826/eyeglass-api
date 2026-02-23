import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommissionsService } from './commissions.service';
import { CommissionsController } from './commissions.controller';
import { CommissionTransaction } from 'src/entities/commission-transaction.entity';
import { Commission } from 'src/entities/commission.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Commission, CommissionTransaction])],
  controllers: [CommissionsController],
  providers: [CommissionsService],
  exports: [CommissionsService],
})
export class CommissionsModule {}
