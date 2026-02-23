import { IsNumber, IsString } from "class-validator";

export class CreateFixedCostDto {
    @IsNumber()
    monthlyFixedCost: number;

    @IsNumber()
    dailyFixedCost: number;

    @IsString()
    description: string;
}
