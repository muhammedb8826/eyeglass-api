import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Lab tools (e.g. base curve blocks) required for producing lens orders.
 * Each tool covers a base curve value or range and has an available quantity (pcs).
 * Order items with a baseCurve must have at least one matching tool with quantity > 0
 * before the order can be produced.
 */
@Entity('lab_tools')
export class LabTool {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Display code, e.g. "125-150" or "250" (optional, for reference) */
  @Column({ nullable: true })
  code: string;

  /** Minimum base curve this tool covers (inclusive). For single-value tools, min = max. */
  @Column('float')
  baseCurveMin: number;

  /** Maximum base curve this tool covers (inclusive). */
  @Column('float')
  baseCurveMax: number;

  /** Available quantity (pieces). Must be > 0 for the tool to be considered available. */
  @Column('float', { default: 1 })
  quantity: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
