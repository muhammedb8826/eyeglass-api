import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBincardTable1730180000000 implements MigrationInterface {
  name = 'AddBincardTable1730180000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "bincard" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "itemId" uuid NOT NULL,
        "movementType" character varying(3) NOT NULL,
        "quantity" float NOT NULL,
        "balanceAfter" float NOT NULL,
        "referenceType" character varying(20) NOT NULL,
        "referenceId" uuid,
        "description" character varying,
        "uomId" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_bincard" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `ALTER TABLE "bincard" ADD CONSTRAINT "FK_bincard_item" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "bincard" ADD CONSTRAINT "FK_bincard_uom" FOREIGN KEY ("uomId") REFERENCES "uom"("id") ON DELETE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "bincard" DROP CONSTRAINT "FK_bincard_uom"`);
    await queryRunner.query(`ALTER TABLE "bincard" DROP CONSTRAINT "FK_bincard_item"`);
    await queryRunner.query(`DROP TABLE "bincard"`);
  }
}
