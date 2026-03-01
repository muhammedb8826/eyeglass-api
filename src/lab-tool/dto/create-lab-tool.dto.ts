import { IsNumber, IsString, IsOptional, Min } from 'class-validator';

export class CreateLabToolDto {
  /** Display code, e.g. "125-150" or "250" */
  @IsOptional()
  @IsString()
  code?: string;

  /** Minimum base curve this tool covers (inclusive). For single-value tools, use same as baseCurveMax. */
  @IsNumber()
  @Min(0)
  baseCurveMin: number;

  /** Maximum base curve this tool covers (inclusive). */
  @IsNumber()
  @Min(0)
  baseCurveMax: number;

  /** Available quantity (pieces). */
  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;
}
