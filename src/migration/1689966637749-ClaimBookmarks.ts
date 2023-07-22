import { MigrationInterface, QueryRunner } from "typeorm"

export class ClaimBookmark1689966637749 implements MigrationInterface {

    // The default is to use the class name but somehow Android loses the name in the apk.
    public name = "ClaimBookmark1689966637749"

    public async up(queryRunner: QueryRunner): Promise<void> {
        const createSql =
          `CREATE TABLE "claimBookmark" (
            "cachedClaimStr" TEXT,
            "claimId" TEXT,
            "context" TEXT,
            "issuedAt" TEXT,
            "issuer" TEXT,
            "name" TEXT,
            "type" TEXT
          )`
        const result = await queryRunner.query(createSql)
        console.log('Up Migration of', this.name, 'got', result)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const result = await queryRunner.query('DROP TABLE "bookmark"')
        console.log('Down Migration of', this.name, 'got', result)
    }

}
