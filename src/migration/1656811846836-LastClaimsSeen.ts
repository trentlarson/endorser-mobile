import {MigrationInterface, QueryRunner} from "typeorm";

export class LastClaimsSeen1656811846836 implements MigrationInterface {

  public name = "LastClaimsSeen1656811846836"

  public async up(queryRunner: QueryRunner): Promise<void> {
    const migrateSql1 = 'ALTER TABLE "settings" ADD COLUMN "lastDailyTaskTime" TEXT'
    const result1 = await queryRunner.query(migrateSql1)

    const migrateSql2 = 'ALTER TABLE "settings" ADD COLUMN "lastNotifiedClaimId" TEXT'
    const result2 = await queryRunner.query(migrateSql2)

    const migrateSql3 = 'ALTER TABLE "settings" ADD COLUMN "lastViewedClaimId" TEXT'
    const result3 = await queryRunner.query(migrateSql3)

    const migrateSql4 = 'ALTER TABLE "settings" ADD COLUMN "apiServer" TEXT'
    const result4 = await queryRunner.query(migrateSql4)

    console.log('Up Migrations for last claims seen', result1, result2, result3, result4)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const migrateSql1 = 'ALTER TABLE "settings" DROP COLUMN "lastDailyTaskTime"'
    const result1 = await queryRunner.query(migrateSql1)

    const migrateSql2 = 'ALTER TABLE "settings" DROP COLUMN "lastNotifiedClaimId"'
    const result2 = await queryRunner.query(migrateSql2)

    const migrateSql3 = 'ALTER TABLE "settings" DROP COLUMN "lastViewedClaimId"'
    const result3 = await queryRunner.query(migrateSql3)

    const migrateSql4 = 'ALTER TABLE "settings" DROP COLUMN "apiServer"'
    const result4 = await queryRunner.query(migrateSql4)

    console.log('Down Migration for last claims seen', result1, result2, result3, result4)
  }

}
