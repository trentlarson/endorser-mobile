import * as bip39 from 'bip39'
import * as crypto from 'crypto'
import { HDNode } from '@ethersproject/hdnode'
import * as R from 'ramda'
import React, { useEffect, useState } from "react"
import { ActivityIndicator, Button, FlatList, SafeAreaView, ScrollView, Text, TextInput, View } from "react-native"
import { CheckBox } from "react-native-elements"
import { classToPlain } from "class-transformer"
import QRCode from "react-native-qrcode-svg"
import Clipboard from "@react-native-community/clipboard"
import { IIdentifier  } from "@veramo/core"

import { MASTER_COLUMN_VALUE, Settings } from "../entity/settings"
import * as utility from "../utility/utility"
import { appSlice, appStore, Identifier } from "../veramo/appSlice"
import { agent, dbConnection } from "../veramo/setup"

const DEFAULT_DID_PROVIDER = 'did:ethr'
// from https://github.com/uport-project/veramo/discussions/346#discussioncomment-302234
const UPORT_ROOT_DERIVATION_PATH = "m/7696500'/0'/0'/0'"

var setStatus = () => ''

const newIdentifier = (address: string, publicHex: string, privateHex: string): Omit<IIdentifier, 'provider'> => {
  return {
    did: DEFAULT_DID_PROVIDER + ':' + address,
    keys: [{
      kid: publicHex,
      kms: 'local',
      type: 'Secp256k1',
      publicKeyHex: publicHex,
      privateKeyHex: privateHex
    }],
    provider: DEFAULT_DID_PROVIDER,
    services: []
  }
}

const storeIdentifier = async (newId: Omit<IIdentifier, 'provider'>, mnemonic: string) => {

  try {
    /**
      First save the mnemonic, because: we've seen cases where the identifier import fails, and if they don't have the mnemonic then they can't restore their identifier, but maybe if the mnemonic is saved then they can export and import it through the UI.
     **/
    console.log('About to save settings...')
    const settings = new Settings()
    settings.id = MASTER_COLUMN_VALUE
    settings.mnemonic = mnemonic
    const conn = await dbConnection
    console.log('... with settings DB connection ready...')
    let newContact = await conn.manager.save(settings)
    console.log('... settings saved.')
    setStatus(s => s + '\n ... saved mnemonic...')

    console.log('About to import identifier...')
    const savedId = await agent.didManagerImport(newId)
    setStatus(s => s + '\n ... imported new ID...')
    console.log('... identifier imported.')
    return savedId
  } catch (e) {
    // In release mode, a thrown error didn't give any helpful info.

    // I have seen cases where each of these give different, helpful info.
    console.log('Error storing identifier, 1:', e)
    console.log('Error storing identifier, 2: ' + e)
    console.log('Error storing identifier, 3:', e.toString())
    throw e
  }
}

// Import and existing ID
const importAndStoreIdentifier = async (mnemonic: string, toLowercase: boolean) => {

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
  setStatus(s => s + '\n ... created HDNode...')
  const rootNode: HDNode = hdnode.derivePath(UPORT_ROOT_DERIVATION_PATH)
  setStatus(s => s + '\n ... derived root HDNode...')
  const privateHex = rootNode.privateKey.substring(2)
  const publicHex = rootNode.privateKey.substring(2)
  let address = rootNode.address
  if (toLowercase) {
    address = address.toLowerCase()
  }

  const newId = newIdentifier(address, publicHex, privateHex)
  setStatus(s => s + '\n ... got new identifier ' + address + '...')

  // awaiting because otherwise the UI may not see that a mnemonic was created
  const savedId = await storeIdentifier(newId, mnemonic)
  setStatus(s => s + '\n ... saved ID...')
  return savedId
}

// Create a totally new ID
const createAndStoreIdentifier = async () => {

  // This doesn't give us the entropy/seed.
  //const id = await agent.didManagerCreate()

  const entropy = crypto.randomBytes(32)
  setStatus(s => s + '\n Created entropy...')
  const mnemonic = bip39.entropyToMnemonic(entropy)
  setStatus(s => s + '\n ... set mnemonic...')

  return importAndStoreIdentifier(mnemonic)
}

// uPort's QR code format
function uportJwtPayload(did, name, publicKeyHex) {
  const publicEncKey = Buffer.from(publicKeyHex, 'hex').toString('base64')
  return {
    iat: Date.now(),
    iss: did,
    own: {
      name,
      publicEncKey,
    },
  }
}

export function SettingsScreen({navigation}) {
  const [createStatus, setCreateStatus] = useState<string>('')
  const [creatingId, setCreatingId] = useState<boolean>(false)
  const [identifiers, setIdentifiers] = useState<Identifier[]>([])
  const [hasMnemonic, setHasMnemonic] = useState<boolean>(false)
  const [inputName, setInputName] = useState<string>('')
  const [storedName, setStoredName] = useState<string>('')
  const [qrJwts, setQrJwts] = useState<Record<string,string>>({})

  const deleteIdentifier = async () => {
    if (identifiers.length > 0) {
      const oldIdent = identifiers[identifiers.length - 1]
      await agent.didManagerDelete(oldIdent)
      const conn = await dbConnection
      await conn.manager.update(Settings, MASTER_COLUMN_VALUE, {mnemonic: null})
      const ids = await agent.didManagerFind()
      setIdentifiers(ids)
      setQrJwts(jwts => R.omit([oldIdent.did], jwts))
    }
  }

  const setNewId = async (ident) => {
    setIdentifiers((s) => s.concat([classToPlain(ident)]))
    const conn = await dbConnection
    let settings = await conn.manager.findOne(Settings, MASTER_COLUMN_VALUE)
    if (settings?.mnemonic) {
      setHasMnemonic(true)
    }
    setStatus(s => s + '\n ... stored in DB...')

    const sharePayload = uportJwtPayload(ident, inputName, ident.keys[0].publicKeyHex)
    setQrJwtForPayload(ident, sharePayload)
  }

  const storeNewName = async () => {
    const conn = await dbConnection
    await conn.manager.update(Settings, MASTER_COLUMN_VALUE, {name: inputName})
    identifiers.forEach(ident => {
      const sharePayload = uportJwtPayload(ident, inputName, ident.keys[0].publicKeyHex)
      setQrJwtForPayload(ident, sharePayload)
    })
    setStoredName(inputName)
  }

  const setQrJwtForPayload = async (identifier, payload) => {
    const newJwt = await utility.createJwt(identifier, payload)
    setStatus(s => s + '\n ... created JWT.')
    const viewPrefix = appStore.getState().viewServer + utility.ENDORSER_JWT_URL_LOCATION
    const qrJwt = viewPrefix + newJwt
    setQrJwts(jwts => R.set(R.lensProp(identifier.did), qrJwt, jwts))
  }

  // Check for existing identifers on load and set them to state
  useEffect(() => {
    const getIdentifiers = async () => {
      const ids = await agent.didManagerFind()
      const pojoIds = ids.map(classToPlain)
      setIdentifiers(pojoIds)

      const conn = await dbConnection
      let settings = await conn.manager.findOne(Settings, MASTER_COLUMN_VALUE)
      if (settings?.mnemonic) {
        setHasMnemonic(true)
      }
      if (settings?.name) {
        setStoredName(settings?.name)
        setInputName(settings?.name)
      }

      pojoIds.forEach(ident => {
        const sharePayload = uportJwtPayload(ident.did, settings?.name, ident.keys[0].publicKeyHex)
        setQrJwtForPayload(ident, sharePayload)
      })
    }
    getIdentifiers()
  }, []) // Why does this loop infinitely with any variable, even with classToPlain(identifiers) that doesn't change?

  useEffect(() => {
    const createIdentifier = async () => {
      createAndStoreIdentifier()
      .then(setNewId)
      .then(() => setCreatingId(false))
    }
    if (creatingId) {
      createIdentifier()
    }
  }, [creatingId])

  setStatus = setCreateStatus

  return (
    <SafeAreaView>
      <ScrollView>
        <View style={{padding: 20}}>
          <Text style={{fontSize: 30, fontWeight: 'bold'}}>Your Info</Text>
          <View style={{ marginTop: 20 }}>
            <Text>Name</Text>
            <TextInput
              value={inputName ? inputName : ''}
              onChangeText={setInputName}
              editable
              style={{borderWidth: 1}}
            />
            { inputName === storedName
              ? <View/>
              : <View>
                <Button title="Save" onPress={storeNewName} />
                <View style={{ backgroundColor: 'rgba(0,0,0,0.9)', height: 0.8, width: '100%', marginBottom: 20 }}/>
              </View>
            }
          </View>
          <View style={{ marginTop: 20 }}>
            {
              R.isEmpty(identifiers)
              ?
                <View>
                  <Text>There are no identifiers.</Text>
                  { creatingId
                    ? <View>
                      <Text>{createStatus}</Text>
                      <ActivityIndicator size={'large'}/>
                    </View>
                    : <View>
                      <Button title="Create Identifier" onPress={() => { setCreatingId(true) }} />
                      <Button title="Import Identifier" onPress={() => navigation.navigate('Import Identifier')}
                      />
                    </View>
                  }
                </View>
              :
                <View style={{ marginBottom: 60 }}>
                  <Text>Identifier</Text>
                  { Object.keys(qrJwts).map(id =>
                    <View key={id} style={{ marginTop: 40 }}>
                      <Text style={{ fontSize: 11, marginTop: 20, marginBottom: 20 }}>{id}</Text>
                      <Text style={{ marginBottom: 20 }}>Your Info</Text>
                      <QRCode value={qrJwts[id]} size={300}/>
                    </View>
                  )}
                  <View style={{marginTop: 40}}>
                    <Button
                    title="Export Identifier"
                    onPress={() => navigation.navigate('Export Identifier')}
                    />
                  </View>
                </View>
            }

            { utility.TEST_MODE
              ? <View style={{ marginTop: 200 }}>
                  <Button title="Create ID" onPress={() => { setCreatingId(true) }} />
                  <Button title="Delete Last ID" onPress={deleteIdentifier} />
                </View>
              : <View/>
            }
          </View>
          <View>
            <Text style={{fontSize: 30, fontWeight: 'bold'}}>Other</Text>
            <Text>Endorser API Server</Text>
            <TextInput
              style={{borderWidth: 1}}
              onChangeText={(text) => {
                appStore.dispatch(appSlice.actions.setApiServer(text))
              }}>
              {appStore.getState().apiServer}
            </TextInput>
            <Text>Endorser View Server</Text>
            <TextInput
              style={{borderWidth: 1}}
              onChangeText={(text) => {
                appStore.dispatch(appSlice.actions.setViewServer(text))
              }}>
              {appStore.getState().viewServer}
            </TextInput>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

export function ExportIdentityScreen({navigation}) {
  const [mnemonic, setMnemonic] = useState<String>('')
  const [show, setShow] = useState<String>(false)

  const copyToClipboard = () => {
    Clipboard.setString(mnemonic)
  }

  // Check for existing identifers on load and set them to state
  useEffect(() => {
    const getMnemonic = async () => {
      const conn = await dbConnection
      const settings = await conn.manager.findOne(Settings, MASTER_COLUMN_VALUE)
      const mnemonic = settings.mnemonic
      setMnemonic(mnemonic)
    }
    getMnemonic()
  }, [])

  return (
    <View style={{padding: 20}}>
      <View style={{marginBottom: 50, marginTop: 20}}>
        {mnemonic ? (
          <View>
            {show ? (
              <View>
                <TextInput
                  multiline={true}
                  style={{borderWidth: 1, height: 100}}
                >
                  {mnemonic}
                </TextInput>
                <Button
                  title="Copy to Clipboard"
                  onPress={copyToClipboard}
                />
              </View>
            ) : (
              <View>
                <Text>BEWARE: Anyone who gets hold of this mnemonic will be able to impersonate you and
                  take over any digital holdings based on it. So only reveal it when you are in a
                  private place out of sight of cameras and other eyes, and only record it in
                  something private -- don't take a screenshot or send it to any online
                  service.</Text>
                <Button title={'Click to show identifier mnemonic'} onPress={setShow}/>
              </View>
            )}
          </View>
        ) : (
          <View>
            <Text>There is no mnemonic to export.</Text>
          </View>
        )}
      </View>
    </View>
  )
}

export function ImportIdentityScreen({navigation}) {
  const [identifier, setIdentifier] = useState<Identifier>()
  const [makeLowercase, setMakeLowercase] = useState<boolean>(false)
  const [mnemonic, setMnemonic] = useState<String>('')
  const [idChanged, setIdChanged] = useState<boolean>(false)

  // Check for existing identifers on load and set them to state
  useEffect(() => {
    const getIdentifiers = async () => {
      const ids = await agent.didManagerFind()
      setIdentifier(ids[0])
    }
    getIdentifiers()
  }, [])

  const importIdentifier = async () => {
    importAndStoreIdentifier(mnemonic, makeLowercase).then(newIdentifier => {
      setIdentifier(newIdentifier)
      setIdChanged(true)

      // one reason redirect automatically is to force reload of ID (which doen't show if they go "back")
      setTimeout(() => navigation.popToTop(), 500)
    })
  }

  return (
    <SafeAreaView>
      <ScrollView>
        <View style={{padding: 20}}>
          <Text style={{fontSize: 30, fontWeight: 'bold'}}>Mnemonic</Text>
          <View style={{marginBottom: 50, marginTop: 20}}>
            {idChanged ? (
              <Text style={{fontSize: 30}}>Success!</Text>
            ) : (
              identifier ? (
                <View>
                  <Text>You have an identifier, and you can only have one.</Text>
                </View>
              ) : (
                <View>
                  <Text>Enter mnemonic:</Text>
                  <TextInput
                    multiline={true}
                    style={{borderWidth: 1, height: 100}}
                    onChangeText={setMnemonic}
                  >
                  </TextInput>
                  <CheckBox
                    title='Convert to Lowercase'
                    checked={makeLowercase}
                    onPress={() => setMakeLowercase(!makeLowercase)}
                  />
                  <Button
                    title={'Click to import from mnemonic'}
                    onPress={importIdentifier}
                  />
                </View>
              )
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}