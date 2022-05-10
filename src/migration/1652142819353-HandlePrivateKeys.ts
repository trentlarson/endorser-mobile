import { computePublicKey } from '@ethersproject/signing-key'
import { MigrationInterface, QueryRunner } from "typeorm";

import { Contact } from '../entity/contact'
import * as utility from '../utility/utility'
import { agent } from "../veramo/setup"

// fix historical keys that were incorrect
export class HandlePrivateKeys1652142819353 implements MigrationInterface {

  public name = "HandlePrivateKeys1652142819353"

  public async up(queryRunner: QueryRunner): Promise<void> {

    const results = []

    const selectKeys = "SELECT kid, publicKeyHex FROM key"
    const resultKeys = await queryRunner.query(selectKeys)
    resultKeys.forEach(async key => {
      if (key.publicKeyHex && key.publicKeyHex.length == 64) {
        const publicKeyHex = computePublicKey(Buffer.from(key.publicKeyHex, 'hex'), true)
        const updateKey = "UPDATE key SET publicKeyHex = '" + publicKeyHex + "' where kid = '" + key.kid + "'"
        const result = await queryRunner.query(updateKey)
        results.push(result)
      }
    })

    const selectContacts = "SELECT did, pubKeyBase64 FROM contact"
    const resultContacts = await queryRunner.query(selectContacts)
    resultContacts.forEach(async contact => {
      const newKeyBase64 = utility.checkPubKeyBase64(contact.pubKeyBase64)
      if (newKeyBase64 != contact.pubKeyBase64) {
        const updateContact = "UPDATE contact SET pubKeyBase64 = '" + newKeyBase64 + "' where did = '" + contact.did + "'"
        const result = await queryRunner.query(updateContact)
        results.push(result)
      }
    })

    console.log('Up Migration of public keys', results)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // don't do anything backwards
    console.log('Down Migration of public keys')
  }

}
