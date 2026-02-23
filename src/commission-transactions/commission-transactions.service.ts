import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateCommissionTransactionDto } from './dto/create-commission-transaction.dto';
import { UpdateCommissionTransactionDto } from './dto/update-commission-transaction.dto';
import { CommissionTransaction } from 'src/entities/commission-transaction.entity';

@Injectable()
export class CommissionTransactionsService {
  constructor(
    @InjectRepository(CommissionTransaction)
    private readonly commissionTransactionRepository: Repository<CommissionTransaction>,
  ) {}

  async create(createCommissionTransactionDto: CreateCommissionTransactionDto) {
    try {
      const commissionTransaction = this.commissionTransactionRepository.create({
        commissionId: createCommissionTransactionDto.commissionId,
        amount: createCommissionTransactionDto.amount,
        paymentMethod: createCommissionTransactionDto.paymentMethod,
        percentage: createCommissionTransactionDto.percentage,
        status: createCommissionTransactionDto.status,
        description: createCommissionTransactionDto.description,
        date: new Date(createCommissionTransactionDto.date),
        reference: createCommissionTransactionDto.reference,
      });

      return await this.commissionTransactionRepository.save(commissionTransaction);
    } catch (error) {
      console.error('Error creating commission transaction:', error);

      if (error.code === 'ER_DUP_ENTRY') {
        throw new ConflictException('Unique constraint failed. Please check your data.');
      }

      throw new Error(`An unexpected error occurred: ${error.message}`);
    }
  }

  async findAll() {
    return this.commissionTransactionRepository.find({
      relations: {
        commission: {
          salesPartner: true,
          order: true
        }
      }
    });
  }

  async findOne(id: string) {
    const commissionTransaction = await this.commissionTransactionRepository.findOne({
      where: { id },
      relations: {
        commission: {
          salesPartner: true,
          order: true
        }
      }
    });

    if (!commissionTransaction) {
      throw new NotFoundException(`Commission Transaction with ID ${id} not found`);
    }

    return commissionTransaction;
  }

  async update(id: string, updateCommissionTransactionDto: UpdateCommissionTransactionDto) {
    const commissionTransaction = await this.commissionTransactionRepository.findOne({
      where: { id }
    });

    if (!commissionTransaction) {
      throw new NotFoundException(`Commission Transaction with ID ${id} not found`);
    }

    await this.commissionTransactionRepository.update(id, {
      date: new Date(updateCommissionTransactionDto.date),
      paymentMethod: updateCommissionTransactionDto.paymentMethod,
      reference: updateCommissionTransactionDto.reference,
      amount: parseFloat(updateCommissionTransactionDto.amount.toString()),
      status: updateCommissionTransactionDto.status,
      description: updateCommissionTransactionDto.description || null,
      commissionId: updateCommissionTransactionDto.commissionId,
    });

    return await this.commissionTransactionRepository.findOne({
      where: { id },
      relations: {
        commission: {
          salesPartner: true,
          order: true
        }
      }
    });
  }

  async remove(id: string) {
    const commissionTransaction = await this.commissionTransactionRepository.findOne({
      where: { id }
    });

    if (!commissionTransaction) {
      throw new NotFoundException(`Commission Transaction with ID ${id} not found`);
    }

    await this.commissionTransactionRepository.remove(commissionTransaction);
    return { message: `Commission Transaction with ID ${id} removed successfully` };
  }
}
