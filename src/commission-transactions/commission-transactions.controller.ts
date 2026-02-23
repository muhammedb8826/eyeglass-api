import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { CommissionTransactionsService } from './commission-transactions.service';
import { CreateCommissionTransactionDto } from './dto/create-commission-transaction.dto';
import { UpdateCommissionTransactionDto } from './dto/update-commission-transaction.dto';

@Controller('commission-transactions')
export class CommissionTransactionsController {
  constructor(private readonly commissionTransactionsService: CommissionTransactionsService) {}

  @Post()
  create(@Body() createCommissionTransactionDto: CreateCommissionTransactionDto) {
    return this.commissionTransactionsService.create(createCommissionTransactionDto);
  }

  @Get()
  findAll() {
    return this.commissionTransactionsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.commissionTransactionsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCommissionTransactionDto: UpdateCommissionTransactionDto) {
    return this.commissionTransactionsService.update(id, updateCommissionTransactionDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.commissionTransactionsService.remove(id);
  }
}
