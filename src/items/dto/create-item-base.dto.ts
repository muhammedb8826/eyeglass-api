import { IsNumber, IsString, Min } from 'class-validator';

export class CreateItemBaseDto {
  /** Base code from supplier (e.g. 350, 575, 400, 600, 800, 1000). Notation: 350+25 → baseCode "350", addPower 2.5 */
  @IsString()
  baseCode: string;

  /** Add power in diopters (e.g. 2.5 for +2.50 D, 7.5 for +7.50 D). +25 in industry notation = 2.5 here. */
  @IsNumber()
  @Min(0)
  addPower: number;
}
