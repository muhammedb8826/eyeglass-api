import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { PaymentTermsService } from './payment-terms.service';
import { CreatePaymentTermDto } from './dto/create-payment-term.dto';
import { UpdatePaymentTermDto } from './dto/update-payment-term.dto';
import { RequirePermissions } from 'src/decorators/permissions.decorator';
import { Permissions } from 'src/permissions/permission.constants';

@Controller('payment-terms')
@RequirePermissions(Permissions.FINANCE_READ)
export class PaymentTermsController {
  constructor(private readonly paymentTermsService: PaymentTermsService) {}

  @Post()
  @RequirePermissions(Permissions.FINANCE_WRITE)
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
  @RequirePermissions(Permissions.FINANCE_WRITE)
  update(@Param('id') id: string, @Body() updatePaymentTermDto: UpdatePaymentTermDto) {
    return this.paymentTermsService.update(id, updatePaymentTermDto);
  }

  @Delete(':id')
  @RequirePermissions(Permissions.FINANCE_WRITE)
  remove(@Param('id') id: string) {
    return this.paymentTermsService.remove(id);
  }
}
