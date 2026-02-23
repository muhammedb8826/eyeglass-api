import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreatePaymentTermDto } from './dto/create-payment-term.dto';
import { UpdatePaymentTermDto } from './dto/update-payment-term.dto';
import { PaymentTerm } from 'src/entities/payment-term.entity';


@Injectable()
export class PaymentTermsService {
  constructor(
    @InjectRepository(PaymentTerm)
    private readonly paymentTermRepository: Repository<PaymentTerm>,
  ) {}

  async create(createPaymentTermDto: CreatePaymentTermDto) {
    const paymentTerm = this.paymentTermRepository.create({
      totalAmount: createPaymentTermDto.totalAmount,
      remainingAmount: createPaymentTermDto.remainingAmount,
      forcePayment: createPaymentTermDto.forcePayment,
      status: createPaymentTermDto.status,
      orderId: createPaymentTermDto.orderId,
    });

    return await this.paymentTermRepository.save(paymentTerm);
  }

  async findAll() {
    return await this.paymentTermRepository.find({
      relations: ['transactions'],
    });
  }

  async findOne(id: string) {
    return await this.paymentTermRepository.findOne({
      where: { id },
      relations: ['transactions'],
    });
  }

  async update(id: string, updatePaymentTermDto: UpdatePaymentTermDto) {
    await this.paymentTermRepository.update(id, {
      totalAmount: updatePaymentTermDto.totalAmount,
      remainingAmount: updatePaymentTermDto.remainingAmount,
      forcePayment: updatePaymentTermDto.forcePayment,
      status: updatePaymentTermDto.status,
      orderId: updatePaymentTermDto.orderId,
    });

    return await this.paymentTermRepository.findOne({
      where: { id },
      relations: ['transactions'],
    });
  }

  async remove(id: string) {
    const paymentTerm = await this.paymentTermRepository.findOne({
      where: { id },
    });

    if (!paymentTerm) {
      throw new Error('Payment term not found');
    }

    return await this.paymentTermRepository.remove(paymentTerm);
  }
}
