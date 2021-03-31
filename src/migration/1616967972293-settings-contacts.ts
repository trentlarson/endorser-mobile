import {MigrationInterface, QueryRunner} from "typeorm";

export class SettingsContacts1616967972293 implements MigrationInterface {

  // The default is to use the class name but somehow Android loses the name in the apk.
  public name = "SettingsContacts1616967972293"

  public async up(queryRunner: QueryRunner): Promise<any> {
    const settingsSql = "CREATE TABLE \"settings\" (\"id\" text PRIMARY KEY NOT NULL, \"mnemonic\" text, \"name\" text)"
    let result
    result = await queryRunner.query(settingsSql)
    console.log('Migration of Settings', result)

    const contactSql = "CREATE TABLE \"contact\" (\"did\" text PRIMARY KEY NOT NULL, \"name\" text, \"pubKeyBase64\" text, \"seesMe\" boolean)"
    result = await queryRunner.query(contactSql)
    console.log('Migration of Contact', result)
  }

  public async down(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.query("DROP TABLE \"contact\"")
    await queryRunner.query("DROP TABLE \"settings\"")
  }

}
