import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateCommissionDto } from './dto/create-commission.dto';
import { UpdateCommissionDto } from './dto/update-commission.dto';
import { Commission } from 'src/entities/commission.entity';
import { CommissionTransaction } from 'src/entities/commission-transaction.entity';


@Injectable()
export class CommissionsService {
  constructor(
    @InjectRepository(Commission)
    private commissionRepository: Repository<Commission>,
    @InjectRepository(CommissionTransaction)
    private commissionTransactionRepository: Repository<CommissionTransaction>
  ) {}

  async create(createCommissionDto: CreateCommissionDto) {
    const commission = this.commissionRepository.create({
      orderId: createCommissionDto.orderId,
      salesPartnerId: createCommissionDto.salesPartnerId,
      totalAmount: parseFloat(createCommissionDto.totalAmount.toString()),
      paidAmount: parseFloat(createCommissionDto.paidAmount.toString()),
    });

    const savedCommission = await this.commissionRepository.save(commission);

    // Create transactions
    const transactions = createCommissionDto.transactions.map(transaction => 
      this.commissionTransactionRepository.create({
        ...transaction,
        commissionId: savedCommission.id,
        amount: transaction.amount,
        percentage: transaction.percentage,
      })
    );

    await this.commissionTransactionRepository.save(transactions);

    return this.findOne(savedCommission.id);
  }

  async findAll(skip: number, take: number) {
    const [commissions, total] = await this.commissionRepository.findAndCount({
      skip: Number(skip),
      take: Number(take),
      order: {
        createdAt: 'DESC'
      },
      relations: {
        salesPartner: true,
        transactions: true,
        order: true
      }
    });
    
    return {
      commissions,
      total
    };
  }

  async findAllCommissions() {
    return this.commissionRepository.find({
      relations: {
        salesPartner: true,
        transactions: true,
        order: true
      }
    });
  }

  async findOne(id: string) {
    const commission = await this.commissionRepository.findOne({
      where: { id },
      relations: {
        transactions: true,
        salesPartner: true,
        order: true
      }
    });

    if (!commission) {
      throw new NotFoundException(`Commission with ID ${id} not found`);
    }

    return commission;
  }

  async update(id: string, updateCommissionDto: UpdateCommissionDto) {
    const commission = await this.commissionRepository.findOne({ where: { id } });
    if (!commission) {
      throw new NotFoundException(`Commission with ID ${id} not found`);
    }

    const { totalAmount, paidAmount } = updateCommissionDto;

    await this.commissionRepository.update(id, {
      orderId: updateCommissionDto.orderId,
      salesPartnerId: updateCommissionDto.salesPartnerId,
      totalAmount: totalAmount,
      paidAmount: parseFloat(paidAmount.toString()),
    });

    // Update transactions
    for (const transaction of updateCommissionDto.transactions) {
      await this.commissionTransactionRepository.update(transaction.id, {
        date: transaction.date,
        paymentMethod: transaction.paymentMethod,
        reference: transaction.reference,
        amount: transaction.amount,
        percentage: transaction.percentage,
        status: transaction.status,
        description: transaction.description,
      });
    }

    return this.findOne(id);
  }

  async remove(id: string) {
    const commission = await this.commissionRepository.findOne({ where: { id } });
    if (!commission) {
      throw new NotFoundException(`Commission with ID ${id} not found`);
    }
    return await this.commissionRepository.remove(commission);
  }
}
