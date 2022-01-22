import {MigrationInterface, QueryRunner} from "typeorm";

export class HomeScreenConfig1639947962124 implements MigrationInterface {

  // The default is to use the class name but somehow Android loses the name in the apk.
  public name = "HomeScreenConfig1639947962124"

  public async up(queryRunner: QueryRunner): Promise<void> {
    const migrateSql1 = 'ALTER TABLE "settings" ADD COLUMN "homeScreen" TEXT'
    const result1 = await queryRunner.query(migrateSql1)
    console.log('Up Migration for home screen', result1)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const migrateSql1 = 'ALTER TABLE "settings" DROP COLUMN "homeScreen"'
    const result1 = await queryRunner.query(migrateSql1)
    console.log('Down Migration for home screen', result1)
  }

}
