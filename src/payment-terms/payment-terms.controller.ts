import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { PaymentTermsService } from './payment-terms.service';
import { CreatePaymentTermDto } from './dto/create-payment-term.dto';
import { UpdatePaymentTermDto } from './dto/update-payment-term.dto';

@Controller('payment-terms')
export class PaymentTermsController {
  constructor(private readonly paymentTermsService: PaymentTermsService) {}

  @Post()
  create(@Body() createPaymentTermDto: CreatePaymentTermDto) {
    return this.paymentTermsService.create(createPaymentTermDto);
  }

  @Get()
  findAll() {
    return this.paymentTermsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.paymentTermsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updatePaymentTermDto: UpdatePaymentTermDto) {
    return this.paymentTermsService.update(id, updatePaymentTermDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.paymentTermsService.remove(id);
  }
}
