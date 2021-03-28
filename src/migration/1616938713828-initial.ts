import {MigrationInterface, QueryRunner} from "typeorm";

// found these after a synchronize via: await queryRunner.query(`select sql from sqlite_master`)
const INITIAL_SQL = [
  "CREATE TABLE \"identifier\" (\"did\" varchar PRIMARY KEY NOT NULL, \"provider\" varchar, \"alias\" varchar, \"saveDate\" datetime NOT NULL DEFAULT (datetime('now')), \"updateDate\" datetime NOT NULL DEFAULT (datetime('now')), \"controllerKeyId\" varchar)",
  "CREATE UNIQUE INDEX \"IDX_6098cca69c838d91e55ef32fe1\" ON \"identifier\" (\"alias\", \"provider\")",
  "CREATE TABLE \"key\" (\"kid\" varchar PRIMARY KEY NOT NULL, \"kms\" varchar NOT NULL, \"type\" varchar NOT NULL, \"publicKeyHex\" varchar NOT NULL, \"privateKeyHex\" varchar NOT NULL, \"meta\" text, \"identifierDid\" varchar, CONSTRAINT \"FK_3f40a9459b53adf1729dbd3b787\" FOREIGN KEY (\"identifierDid\") REFERENCES \"identifier\" (\"did\") ON DELETE NO ACTION ON UPDATE NO ACTION)",
  "CREATE TABLE \"service\" (\"id\" varchar PRIMARY KEY NOT NULL, \"type\" varchar NOT NULL, \"serviceEndpoint\" varchar NOT NULL, \"description\" varchar, \"identifierDid\" varchar, CONSTRAINT \"FK_e16e0280d906951809f95dd09f1\" FOREIGN KEY (\"identifierDid\") REFERENCES \"identifier\" (\"did\") ON DELETE NO ACTION ON UPDATE NO ACTION)",
  "CREATE TABLE \"claim\" (\"hash\" varchar PRIMARY KEY NOT NULL, \"issuanceDate\" datetime NOT NULL, \"expirationDate\" datetime, \"context\" text NOT NULL, \"credentialType\" text NOT NULL, \"type\" varchar NOT NULL, \"value\" text, \"isObj\" boolean NOT NULL, \"issuerDid\" varchar, \"subjectDid\" varchar, \"credentialHash\" varchar, CONSTRAINT \"FK_d972c73d0f875c0d14c35b33baa\" FOREIGN KEY (\"issuerDid\") REFERENCES \"identifier\" (\"did\") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT \"FK_f411679379d373424100a1c73f4\" FOREIGN KEY (\"subjectDid\") REFERENCES \"identifier\" (\"did\") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT \"FK_3d494b79143de3d0e793883e351\" FOREIGN KEY (\"credentialHash\") REFERENCES \"credential\" (\"hash\") ON DELETE NO ACTION ON UPDATE NO ACTION)",
  "CREATE TABLE \"credential\" (\"hash\" varchar PRIMARY KEY NOT NULL, \"raw\" text NOT NULL, \"id\" varchar, \"issuanceDate\" datetime NOT NULL, \"expirationDate\" datetime, \"context\" text NOT NULL, \"type\" text NOT NULL, \"issuerDid\" varchar, \"subjectDid\" varchar, CONSTRAINT \"FK_123d0977e0976565ee0932c0b9e\" FOREIGN KEY (\"issuerDid\") REFERENCES \"identifier\" (\"did\") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT \"FK_b790831f44e2fa7f9661a017b0a\" FOREIGN KEY (\"subjectDid\") REFERENCES \"identifier\" (\"did\") ON DELETE NO ACTION ON UPDATE NO ACTION)",
  "CREATE TABLE \"presentation\" (\"hash\" varchar PRIMARY KEY NOT NULL, \"raw\" text NOT NULL, \"id\" varchar, \"issuanceDate\" datetime NOT NULL, \"expirationDate\" datetime, \"context\" text NOT NULL, \"type\" text NOT NULL, \"holderDid\" varchar, CONSTRAINT \"FK_a5e418449d9f527776a3bd0ca61\" FOREIGN KEY (\"holderDid\") REFERENCES \"identifier\" (\"did\") ON DELETE NO ACTION ON UPDATE NO ACTION)",
  "CREATE TABLE \"message\" (\"id\" varchar PRIMARY KEY NOT NULL, \"saveDate\" datetime NOT NULL DEFAULT (datetime('now')), \"updateDate\" datetime NOT NULL DEFAULT (datetime('now')), \"createdAt\" datetime, \"expiresAt\" datetime, \"threadId\" varchar, \"type\" varchar NOT NULL, \"raw\" varchar, \"data\" text, \"replyTo\" text, \"replyUrl\" varchar, \"metaData\" text, \"fromDid\" varchar, \"toDid\" varchar, CONSTRAINT \"FK_63bf73143b285c727bd046e6710\" FOREIGN KEY (\"fromDid\") REFERENCES \"identifier\" (\"did\") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT \"FK_1a666b2c29bb2b68d91259f55df\" FOREIGN KEY (\"toDid\") REFERENCES \"identifier\" (\"did\") ON DELETE NO ACTION ON UPDATE NO ACTION)",
  "CREATE TABLE \"presentation_verifier_identifier\" (\"presentationHash\" varchar NOT NULL, \"identifierDid\" varchar NOT NULL, CONSTRAINT \"FK_05b1eda0f6f5400cb173ebbc086\" FOREIGN KEY (\"presentationHash\") REFERENCES \"presentation\" (\"hash\") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT \"FK_3a460e48557bad5564504ddad90\" FOREIGN KEY (\"identifierDid\") REFERENCES \"identifier\" (\"did\") ON DELETE CASCADE ON UPDATE NO ACTION, PRIMARY KEY (\"presentationHash\", \"identifierDid\"))",
  "CREATE INDEX \"IDX_05b1eda0f6f5400cb173ebbc08\" ON \"presentation_verifier_identifier\" (\"presentationHash\")",
  "CREATE INDEX \"IDX_3a460e48557bad5564504ddad9\" ON \"presentation_verifier_identifier\" (\"identifierDid\")",
  "CREATE TABLE \"presentation_credentials_credential\" (\"presentationHash\" varchar NOT NULL, \"credentialHash\" varchar NOT NULL, CONSTRAINT \"FK_d796bcde5e182136266b2a6b72c\" FOREIGN KEY (\"presentationHash\") REFERENCES \"presentation\" (\"hash\") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT \"FK_ef88f92988763fee884c37db63b\" FOREIGN KEY (\"credentialHash\") REFERENCES \"credential\" (\"hash\") ON DELETE CASCADE ON UPDATE NO ACTION, PRIMARY KEY (\"presentationHash\", \"credentialHash\"))",
  "CREATE INDEX \"IDX_d796bcde5e182136266b2a6b72\" ON \"presentation_credentials_credential\" (\"presentationHash\")",
  "CREATE INDEX \"IDX_ef88f92988763fee884c37db63\" ON \"presentation_credentials_credential\" (\"credentialHash\")",
  "CREATE TABLE \"message_presentations_presentation\" (\"messageId\" varchar NOT NULL, \"presentationHash\" varchar NOT NULL, CONSTRAINT \"FK_7e7094f2cd6e5ec93914ac5138f\" FOREIGN KEY (\"messageId\") REFERENCES \"message\" (\"id\") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT \"FK_a13b5cf828c669e61faf489c182\" FOREIGN KEY (\"presentationHash\") REFERENCES \"presentation\" (\"hash\") ON DELETE CASCADE ON UPDATE NO ACTION, PRIMARY KEY (\"messageId\", \"presentationHash\"))",
  "CREATE INDEX \"IDX_7e7094f2cd6e5ec93914ac5138\" ON \"message_presentations_presentation\" (\"messageId\")",
  "CREATE INDEX \"IDX_a13b5cf828c669e61faf489c18\" ON \"message_presentations_presentation\" (\"presentationHash\")",
  "CREATE TABLE \"message_credentials_credential\" (\"messageId\" varchar NOT NULL, \"credentialHash\" varchar NOT NULL, CONSTRAINT \"FK_1c111357e73db91a08525914b59\" FOREIGN KEY (\"messageId\") REFERENCES \"message\" (\"id\") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT \"FK_8ae8195a94b667b185d2c023e33\" FOREIGN KEY (\"credentialHash\") REFERENCES \"credential\" (\"hash\") ON DELETE CASCADE ON UPDATE NO ACTION, PRIMARY KEY (\"messageId\", \"credentialHash\"))",
  "CREATE INDEX \"IDX_1c111357e73db91a08525914b5\" ON \"message_credentials_credential\" (\"messageId\")",
  "CREATE INDEX \"IDX_8ae8195a94b667b185d2c023e3\" ON \"message_credentials_credential\" (\"credentialHash\")",
]

export class Initial1616938713828 implements MigrationInterface {

  public async up(queryRunner: QueryRunner): Promise<any> {
    console.log('Starting initial migration...')
    const initialProms = INITIAL_SQL.map(async (sql, index) => {
      return queryRunner.query(sql);
    })
    Promise.all(initialProms)
    .then((results) => console.log('... finished initial migration: ', results))
  }

  public async down(queryRunner: QueryRunner): Promise<any> {
    throw 'No rollback for the initial migration is implemented.'
  }

}
