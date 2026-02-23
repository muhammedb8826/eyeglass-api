export class CreateOperatorStockDto {
    id: string;
    itemId: string;
    uomId: string;
    quantity: number;
    description?: string;
    status: string;
    baseUomId: string;
    unit: number;
}
