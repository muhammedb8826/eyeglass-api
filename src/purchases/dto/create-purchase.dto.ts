import { CreatePurchaseItemDto } from "src/purchase-items/dto/create-purchase-item.dto";

export class CreatePurchaseDto {
    id: string;
    series: string;
    vendorId: string;
    purchaserId: string;
    status: string;
    orderDate: Date;
    paymentMethod: string;
    amount: number;
    reference?: string;
    totalAmount: number;
    totalQuantity: number;
    note?: string;

    // Nested DTO
    purchaseItems: CreatePurchaseItemDto[];
}
