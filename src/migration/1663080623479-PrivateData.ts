import {MigrationInterface, QueryRunner} from "typeorm";

export class PrivateData1663080623479 implements MigrationInterface {

  // The default is to use the class name but somehow Android loses the name in the apk.
  public name = "PrivateData1663080623479"

  public async up(queryRunner: QueryRunner): Promise<void> {
    const settingsSql = 'CREATE TABLE "privateData" ("id" INTEGER PRIMARY KEY, "fields" TEXT, "fieldsMerkle" TEXT, "did" TEXT, "claimContext" TEXT, "claimType" TEXT, "serverId" TEXT, "serverUrl" TEXT, "templateIpfsCid" TEXT, "legalMdHash" TEXT)'
    const result = await queryRunner.query(settingsSql)
    console.log('Up Migration of PrivateData got', result)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const result = await queryRunner.query('DROP TABLE "privateData"')
    console.log('Down Migration of PrivateData got', result)
  }

}
