import { CreateCommissionTransactionDto } from "src/commission-transactions/dto/create-commission-transaction.dto"

export class CreateCommissionDto {
    id: string
    orderId: string
    salesPartnerId: string
    totalAmount: number
    paidAmount: number
    transactions?: CreateCommissionTransactionDto[];
}
