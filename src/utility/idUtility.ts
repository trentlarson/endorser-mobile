import * as bip39 from 'bip39'
import { classToPlain } from "class-transformer"
import * as crypto from 'crypto'
import { HDNode } from '@ethersproject/hdnode'
import * as R from 'ramda'
import { IIdentifier } from '@veramo/core'

import { MASTER_COLUMN_VALUE, Settings } from '../entity/settings'
import * as utility from '../utility/utility'
import { appSlice, appStore } from "../veramo/appSlice"
import { agent, dbConnection, DEFAULT_DID_PROVIDER_NAME } from '../veramo/setup'

// from https://github.com/uport-project/veramo/discussions/346#discussioncomment-302234
// ... though I recommend leaving the second position (ie. the first "0") for different chains,
// so the third (and more) position(s) would be for different identities, addresses, etc as desired.
export const DEFAULT_ROOT_DERIVATION_PATH = "m/84737769'/0'/0'/0'"
export const UPORT_ROOT_DERIVATION_PATH = "m/7696500'/0'/0'/0'"

const newIdentifier = (address: string, publicHex: string, privateHex: string, derivationPath: string): Omit<IIdentifier, 'provider'> => {
  return {
    did: DEFAULT_DID_PROVIDER_NAME + ':' + address,
    keys: [{
      kid: publicHex,
      kms: 'local',
      // meta is declared as text in SQL but as an object in the entity
      meta: { derivationPath: derivationPath },
      privateKeyHex: privateHex,
      publicKeyHex: publicHex,
      type: 'Secp256k1',
    }],
    provider: DEFAULT_DID_PROVIDER_NAME,
    services: [],
  }
}

const storeIdentifier = async (newId: Omit<IIdentifier, 'provider'>, mnemonic: string, mnemonicPassword: string) => {

  try {
    /**
      First save the mnemonic, because: we've seen cases where the identifier import fails, and if they don't have the mnemonic then they can't restore their identifier, but maybe if the mnemonic is saved then they can export and import it through the UI.
     **/
    appStore.dispatch(appSlice.actions.addLog({log: false, msg: "... about to create Settings entity..."}))

    // This is specified to be a particular length.
    const ivBase64 = crypto.randomBytes(16).toString('base64')
    // There's technically no reason to keep a salt, too, but I'll keep that boilerplate code.
    const salt = crypto.randomBytes(6).toString('base64');

    const settings = new Settings()
    settings.id = MASTER_COLUMN_VALUE
    settings.mnemonic = null // ensure previous, unencrypted mnemonic is erased
    settings.mnemEncrBase64 = utility.encryptAndBase64(mnemonic, mnemonicPassword, salt, ivBase64);
    settings.ivBase64 = ivBase64
    settings.salt = salt
    appStore.dispatch(appSlice.actions.addLog({log: false, msg: "... created Settings entity..."}))

    const conn = await dbConnection
    appStore.dispatch(appSlice.actions.addLog({log: false, msg: "... got DB connection..."}))

    await conn.manager.save(settings) // will skip undefined fields
    appStore.dispatch(appSlice.actions.addLog({log: false, msg: "... mnemonic saved..."}))

    let newSettings = await conn.manager.findOne(Settings, MASTER_COLUMN_VALUE)
    appStore.dispatch(appSlice.actions.setSettings(classToPlain(newSettings)))
    appStore.dispatch(appSlice.actions.addLog({log: false, msg: "... settings cached..."}))

    const savedId = await agent.didManagerImport(newId)
    appStore.dispatch(appSlice.actions.addLog({log: false, msg: "... identifier imported by DID Manager..."}))

    return savedId
  } catch (e) {

    // For some reason, we don't see any error pop-up when we get here (at least in prod, both iOS and Android).

    // In release mode, a thrown error didn't give any helpful info.
    appStore.dispatch(appSlice.actions.addLog({log: true, msg: "Got error in Settings.storeIdentifier: " + e}))

    // I have seen cases where each of these give different, helpful info.
    console.log('Error storing identifier, 1:', e)
    console.log('Error storing identifier, 2: ' + e)
    console.log('Error storing identifier, 3:', e.toString())
    throw e
  }
}

// Import an existing ID
export const importAndStoreIdentifier = async (
  mnemonic: string,
  mnemonicPassword: string,
  derivationPath: string,
  toLowercase: boolean,
  previousIdentifiers: Array<IIdentifier>
) => {

  // just to get rid of variability that might cause an error
  mnemonic = mnemonic.trim().toLowerCase()

  /**
  // an approach I pieced together
  // requires: yarn add elliptic
  // ... plus:
  // const EC = require('elliptic').ec
  // const secp256k1 = new EC('secp256k1')
  //
  const keyHex: string = bip39.mnemonicToEntropy(mnemonic)
  // returns a KeyPair from the elliptic.ec library
  const keyPair = secp256k1.keyFromPrivate(keyHex, 'hex')
  // this code is from did-provider-eth createIdentifier
  const privateHex = keyPair.getPrivate('hex')
  const publicHex = keyPair.getPublic('hex')
  const address = didJwt.toEthereumAddress(publicHex)
  **/

  /**
  // from https://github.com/uport-project/veramo/discussions/346#discussioncomment-302234
  // ... which almost works but the didJwt.toEthereumAddress is wrong
  // requires: yarn add bip32
  // ... plus: import * as bip32 from 'bip32'
  //
  const seed: Buffer = await bip39.mnemonicToSeed(mnemonic)
  const root = bip32.fromSeed(seed)
  const node = root.derivePath(UPORT_ROOT_DERIVATION_PATH)
  const privateHex = node.privateKey.toString("hex")
  const publicHex = node.publicKey.toString("hex")
  const address = didJwt.toEthereumAddress('0x' + publicHex)
  **/

  /**
  // from https://github.com/uport-project/veramo/discussions/346#discussioncomment-302234
  // requires: yarn add @ethersproject/hdnode
  // ... plus: import { HDNode } from '@ethersproject/hdnode'
  **/
  const hdnode: HDNode = HDNode.fromMnemonic(mnemonic)
  const rootNode: HDNode = hdnode.derivePath(derivationPath)
  const privateHex = rootNode.privateKey.substring(2) // original starts with '0x'
  const publicHex = rootNode.publicKey.substring(2) // original starts with '0x'
  let address = rootNode.address

  const prevIds = previousIdentifiers || [];

  if (toLowercase) {
    const foundEqual = R.find(
      (id) => utility.rawAddressOfDid(id.did) === address,
      prevIds
    )
    if (foundEqual) {
      // They're trying to create a lowercase version of one that exists in normal case.
      // (We really should notify the user.)
      appStore.dispatch(appSlice.actions.addLog({log: true, msg: "Will create a normal-case version of the DID since a regular version exists."}))
    } else {
      address = address.toLowerCase()
    }
  } else {
    // They're not trying to convert to lowercase.
    const foundLower = R.find((id) =>
      utility.rawAddressOfDid(id.did) === address.toLowerCase(),
      prevIds
    )
    if (foundLower) {
      // They're trying to create a normal case version of one that exists in lowercase.
      // (We really should notify the user.)
      appStore.dispatch(appSlice.actions.addLog({log: true, msg: "Will create a lowercase version of the DID since a lowercase version exists."}))
      address = address.toLowerCase()
    }
  }

  appStore.dispatch(appSlice.actions.addLog({log: false, msg: "... derived keys and address..."}))

  const newId = newIdentifier(address, publicHex, privateHex, derivationPath)
  appStore.dispatch(appSlice.actions.addLog({log: false, msg: "... created new ID..."}))

  // awaiting because otherwise the UI may not see that a mnemonic was created
  const savedId = await storeIdentifier(newId, mnemonic, mnemonicPassword)
  appStore.dispatch(appSlice.actions.addLog({log: false, msg: "... stored new ID..."}))
  return savedId
}

// Create a totally new ID
export const createAndStoreIdentifier = async (mnemonicPassword, derivationPath) => {

  // This doesn't give us the entropy/seed.
  //const id = await agent.didManagerCreate()

  const entropy = crypto.randomBytes(32)
  const mnemonic = bip39.entropyToMnemonic(entropy)
  appStore.dispatch(appSlice.actions.addLog({log: false, msg: "... generated mnemonic..."}))

  return importAndStoreIdentifier(mnemonic, mnemonicPassword, derivationPath, false, [])
}
