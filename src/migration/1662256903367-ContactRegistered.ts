import {MigrationInterface, QueryRunner} from "typeorm";

export class ContactRegistered1662256903367 implements MigrationInterface {

  public name = "ContactRegistered1662256903367"

  public async up(queryRunner: QueryRunner): Promise<void> {
    const migrateSql1 = 'ALTER TABLE "contact" ADD COLUMN "registered" BOOLEAN'
    const result1 = await queryRunner.query(migrateSql1)
    console.log('Up Migrations for contact registered', result1)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const migrateSql1 = 'ALTER TABLE "contact" DROP COLUMN "registered"'
    const result1 = await queryRunner.query(migrateSql1)
    console.log('Down Migration for contact registered', result1)
  }

}
