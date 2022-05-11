import { computePublicKey } from '@ethersproject/signing-key'
import { MigrationInterface, QueryRunner } from "typeorm";

// fix historical keys that were incorrect
export class HandlePublicKeys1652142819353 implements MigrationInterface {

  public name = "HandlePublicKeys1652142819353"

  // This code is in utility.ts in pubHexFromBuf. Copying here so that we can remove the other later without changing this file.
  private pubHexFromBuf(oldKeyBuf) {
    // computePublicKey returns value with 0x on front
    let newKeyHex = computePublicKey(oldKeyBuf, true)
    if (newKeyHex.startsWith('0x')) {
      newKeyHex = newKeyHex.substring(2) // remove Ethereum prefix
    }
    return newKeyHex
  }

  public async up(queryRunner: QueryRunner): Promise<void> {

    const results = []

    const selectKeys = "SELECT kid, publicKeyHex FROM key"
    const resultKeys = await queryRunner.query(selectKeys)
    resultKeys.forEach(async key => {
      if (key.publicKeyHex && key.publicKeyHex.length == 64) {
        const publicKeyHex = pubHexFromBuf(Buffer.from(key.publicKeyHex, 'hex'))
        const updateKey = "UPDATE key SET publicKeyHex = '" + publicKeyHex + "' where kid = '" + key.kid + "'"
        const result = await queryRunner.query(updateKey)
        results.push(result)
      }
    })

    const selectContacts = "SELECT did, pubKeyBase64 FROM contact"
    const resultContacts = await queryRunner.query(selectContacts)
    resultContacts.forEach(async contact => {

      if (contact.pubKeyBase64) {

        // This code is in utility.ts in checkPubKeyBase64. Copying here so that we can remove the other later without changing this file.
        let newKeyBase64 = contact.pubKeyBase64
        const oldKeyBuf = Buffer.from(contact.pubKeyBase64, 'base64')
        if (oldKeyBuf.length == 32) { // actually a private key
          newKeyBase64 = Buffer.from(pubHexFromBuf(oldKeyBuf), 'hex').toString('base64')
        }

        if (newKeyBase64 != contact.pubKeyBase64) {
          const updateContact = "UPDATE contact SET pubKeyBase64 = '" + newKeyBase64 + "' where did = '" + contact.did + "'"
          const result = await queryRunner.query(updateContact)
          results.push(result)
        }
      }

    })

    console.log('Up Migration of public keys', results)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // don't do anything backwards
    console.log('Down Migration of public keys')
  }

}
