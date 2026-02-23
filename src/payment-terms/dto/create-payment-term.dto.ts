import { CreatePaymentTransactionDto } from "src/payment-transactions/dto/create-payment-transaction.dto"

export class CreatePaymentTermDto {
    id: string
    orderId: string
    totalAmount: number
    remainingAmount: number
    status: string
    forcePayment: boolean;
    transactions?: CreatePaymentTransactionDto[];
}
