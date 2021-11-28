import {MigrationInterface, QueryRunner} from "typeorm";

export class EncryptedSeed1637856484788 implements MigrationInterface {

  public async up(queryRunner: QueryRunner): Promise<any> {
    const migrateSql2 = 'ALTER TABLE "settings" ADD COLUMN "ivBase64" TEXT'
    const result2 = await queryRunner.query(migrateSql2)
    console.log('Up Migration for iv', result2)

    const migrateSql3 = 'ALTER TABLE "settings" ADD COLUMN "salt" TEXT'
    const result3 = await queryRunner.query(migrateSql3)
    console.log('Up Migration for salt', result3)
  }

  public async down(queryRunner: QueryRunner): Promise<any> {
    const migrateSql2 = 'ALTER TABLE "settings" DROP COLUMN "ivBase64"'
    const result2 = await queryRunner.query(migrateSql2)
    console.log('Down Migration for iv', result2)

    const migrateSql3 = 'ALTER TABLE "settings" DROP COLUMN "salt"'
    const result3 = await queryRunner.query(migrateSql3)
    console.log('Down Migration for salt', result3)
  }

}
