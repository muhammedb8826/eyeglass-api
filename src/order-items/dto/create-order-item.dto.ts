import { IsOptional } from "class-validator";

export class CreateOrderItemDto {
    id: string;
    orderId: string;
    itemId: string;
    /** When the item has bases (e.g. 3221 with 350^+25, 575^+25), the chosen variant */
    itemBaseId?: string;
    serviceId?: string;
    nonStockServiceId?: string;
    isNonStockService?: boolean;
    pricingId: string;
    unit: number;
    baseUomId: string;

    @IsOptional()
    discount?: number;

    level: number;

    // Eyeglass lens prescription (per-eye) and lens parameters
    @IsOptional()
    sphereRight?: number;

    @IsOptional()
    sphereLeft?: number;

    @IsOptional()
    cylinderRight?: number;

    @IsOptional()
    cylinderLeft?: number;

    @IsOptional()
    axisRight?: number;

    @IsOptional()
    axisLeft?: number;

    @IsOptional()
    prismRight?: number;

    @IsOptional()
    prismLeft?: number;

    @IsOptional()
    addRight?: number;

    @IsOptional()
    addLeft?: number;

    @IsOptional()
    pd?: number;

    @IsOptional()
    pdMonocularRight?: number;

    @IsOptional()
    pdMonocularLeft?: number;

    @IsOptional()
    lensType?: string;

    @IsOptional()
    lensMaterial?: string;

    @IsOptional()
    lensCoating?: string;

    @IsOptional()
    lensIndex?: number;

    @IsOptional()
    baseCurve?: number;

    @IsOptional()
    diameter?: number;

    @IsOptional()
    tintColor?: string;

    totalAmount: number;
    adminApproval: boolean;
    @IsOptional()
    approvalStatus?: string;
    @IsOptional()
    qualityControlStatus?: string;
    @IsOptional()
    storeRequestStatus?: string;
    uomId: string;
    /** Total quantity (used when per-eye quantities not provided). Otherwise quantityRight + quantityLeft. */
    quantity: number;
    /** Quantity for right lens. Right and left can be produced separately. */
    quantityRight?: number;
    /** Quantity for left lens. Right and left can be produced separately. */
    quantityLeft?: number;
    unitPrice: number;
    description?: string;
    isDiscounted: boolean;
    status: string;

    orderItemNotes: string[];
}
