import {MigrationInterface, QueryRunner} from "typeorm";

export class LatestClaimsSeen1656811846836 implements MigrationInterface {

  public name = "LatestClaimsSeen1656811846836"

  public async up(queryRunner: QueryRunner): Promise<void> {
    const migrateSql1 = 'ALTER TABLE "settings" ADD COLUMN "latestNotifiedClaimId" TEXT'
    const result1 = await queryRunner.query(migrateSql1)

    const migrateSql2 = 'ALTER TABLE "settings" ADD COLUMN "latestViewedClaimId" TEXT'
    const result2 = await queryRunner.query(migrateSql2)
    console.log('Up Migrations for latest claims seen', result1, result2)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const migrateSql1 = 'ALTER TABLE "settings" DROP COLUMN "latestNotifiedClaimId"'
    const result1 = await queryRunner.query(migrateSql1)

    const migrateSql2 = 'ALTER TABLE "settings" DROP COLUMN "latestViewedClaimId"'
    const result2 = await queryRunner.query(migrateSql2)

    console.log('Down Migration for latest claims seen', result1, result2)
  }

}
