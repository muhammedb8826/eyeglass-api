import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentTermsService } from './payment-terms.service';
import { PaymentTermsController } from './payment-terms.controller';
import { PaymentTerm } from 'src/entities/payment-term.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PaymentTerm])],
  controllers: [PaymentTermsController],
  providers: [PaymentTermsService],
})
export class PaymentTermsModule {}
