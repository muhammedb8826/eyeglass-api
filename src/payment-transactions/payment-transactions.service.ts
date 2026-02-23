import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreatePaymentTransactionDto } from './dto/create-payment-transaction.dto';
import { UpdatePaymentTransactionDto } from './dto/update-payment-transaction.dto';
import { PaymentTransaction } from 'src/entities/payment-transaction.entity';


@Injectable()
export class PaymentTransactionsService {
  constructor(
    @InjectRepository(PaymentTransaction)
    private readonly paymentTransactionRepository: Repository<PaymentTransaction>,
  ) {}

  async create(createPaymentTransactionDto: CreatePaymentTransactionDto) {
    try {
      const paymentTransaction = this.paymentTransactionRepository.create({
        date: new Date(createPaymentTransactionDto.date), // Ensuring the date is correctly parsed
        paymentMethod: createPaymentTransactionDto.paymentMethod,
        reference: createPaymentTransactionDto.reference,
        amount: parseFloat(createPaymentTransactionDto.amount.toString()), // Ensuring the amount is a valid float
        status: createPaymentTransactionDto.status,
        description: createPaymentTransactionDto.description || null, // Handling optional description
        paymentTermId: createPaymentTransactionDto.paymentTermId,
      });

      return await this.paymentTransactionRepository.save(paymentTransaction);
    } catch (error) {
      console.error('Error creating payment transaction:', error);

      // Check for unique constraint error
      if (error.code === 'ER_DUP_ENTRY') {
        throw new ConflictException('Unique constraint failed. Please check your data.');
      }

      // General error handling
      throw new Error(`An unexpected error occurred: ${error.message}`);
    }
  }

  async findAll() {
    return this.paymentTransactionRepository.find({
      relations: ['paymentTerm', 'paymentTerm.order'],
    });
  }

  async findOne(id: string) {
    return this.paymentTransactionRepository.findOne({
      where: { id },
      relations: ['paymentTerm', 'paymentTerm.order'],
    });
  }

  async update(id: string, updatePaymentTransactionDto: UpdatePaymentTransactionDto) {
    await this.paymentTransactionRepository.update(id, {
      date: new Date(updatePaymentTransactionDto.date), // Ensuring the date is correctly parsed
      paymentMethod: updatePaymentTransactionDto.paymentMethod,
      reference: updatePaymentTransactionDto.reference,
      amount: parseFloat(updatePaymentTransactionDto.amount.toString()), // Ensuring the amount is a valid float
      status: updatePaymentTransactionDto.status,
      description: updatePaymentTransactionDto.description || null, // Handling optional description
      paymentTermId: updatePaymentTransactionDto.paymentTermId,
    });

    return await this.paymentTransactionRepository.findOne({
      where: { id },
      relations: ['paymentTerm', 'paymentTerm.order'],
    });
  }

  async remove(id: string) {
    const paymentTransaction = await this.paymentTransactionRepository.findOne({
      where: { id },
    });

    if (!paymentTransaction) {
      throw new Error('Payment transaction not found');
    }

    return await this.paymentTransactionRepository.remove(paymentTransaction);
  }
}
