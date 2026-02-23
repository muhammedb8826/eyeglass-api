import { IsOptional } from "class-validator";

export class CreateOrderItemDto {
    id: string;
    orderId: string;
    itemId: string;
    serviceId?: string;
    nonStockServiceId?: string;
    isNonStockService?: boolean;
    width?: number;
    height?: number;
    pricingId: string;
    unit: number;
    baseUomId: string;

    @IsOptional()
    discount?: number;

    
    level: number;
    totalAmount: number;
    adminApproval: boolean;
    uomId: string;
    quantity: number;
    unitPrice: number;
    description?: string;
    isDiscounted: boolean;
    status: string;

    orderItemNotes: string[];
}
