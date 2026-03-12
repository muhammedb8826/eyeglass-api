import { IsUUID, IsNumber, IsPositive } from 'class-validator';

export class CreateBomDto {
  @IsUUID()
  parentItemId: string;

  @IsUUID()
  componentItemId: string;

  @IsNumber()
  @IsPositive()
  quantity: number;

  @IsUUID()
  uomId: string;
}

