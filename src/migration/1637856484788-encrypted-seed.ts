import {MigrationInterface, QueryRunner} from "typeorm";

export class EncryptedSeed1637856484788 implements MigrationInterface {

  public async up(queryRunner: QueryRunner): Promise<any> {
    const migrateSql1 = 'ALTER TABLE "settings" ADD COLUMN "mnemEncrBase64" TEXT'
    const result1 = await queryRunner.query(migrateSql1)
    console.log('Up Migration for mnemonic', result1)

    const migrateSql2 = 'ALTER TABLE "settings" ADD COLUMN "ivBase64" TEXT'
    const result2 = await queryRunner.query(migrateSql2)
    console.log('Up Migration for iv', result2)

    const migrateSql3 = 'ALTER TABLE "settings" ADD COLUMN "salt" TEXT'
    const result3 = await queryRunner.query(migrateSql3)
    console.log('Up Migration for salt', result3)
  }

  public async down(queryRunner: QueryRunner): Promise<any> {
    const migrateSql1 = 'ALTER TABLE "settings" DROP COLUMN "mnemEncrBase64"'
    const result1 = await queryRunner.query(migrateSql1)
    console.log('Down Migration for mnemonic', result1)

    const migrateSql2 = 'ALTER TABLE "settings" DROP COLUMN "ivBase64"'
    const result2 = await queryRunner.query(migrateSql2)
    console.log('Down Migration for iv', result2)

    const migrateSql3 = 'ALTER TABLE "settings" DROP COLUMN "salt"'
    const result3 = await queryRunner.query(migrateSql3)
    console.log('Down Migration for salt', result3)
  }

}
