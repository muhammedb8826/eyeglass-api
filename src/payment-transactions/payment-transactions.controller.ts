import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { PaymentTransactionsService } from './payment-transactions.service';
import { CreatePaymentTransactionDto } from './dto/create-payment-transaction.dto';
import { UpdatePaymentTransactionDto } from './dto/update-payment-transaction.dto';
import { RequirePermissions } from 'src/decorators/permissions.decorator';
import { Permissions } from 'src/permissions/permission.constants';

@Controller('payment-transactions')
@RequirePermissions(Permissions.FINANCE_READ)
export class PaymentTransactionsController {
  constructor(private readonly paymentTransactionsService: PaymentTransactionsService) {}

  @Post()
  @RequirePermissions(Permissions.FINANCE_WRITE)
  create(@Body() createPaymentTransactionDto: CreatePaymentTransactionDto) {
    return this.paymentTransactionsService.create(createPaymentTransactionDto);
  }

  @Get()
  findAll() {
    return this.paymentTransactionsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.paymentTransactionsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updatePaymentTransactionDto: UpdatePaymentTransactionDto) {
    return this.paymentTransactionsService.update(id, updatePaymentTransactionDto);
  }

  @Delete(':id')
  @RequirePermissions(Permissions.FINANCE_WRITE)
  remove(@Param('id') id: string) {
    return this.paymentTransactionsService.remove(id);
  }
}
