export class CreatePaymentTransactionDto {
    id: string
    date: Date
    paymentTermId: string
    paymentMethod: string
    reference: string
    amount: number
    status: string
    description?: string
}
