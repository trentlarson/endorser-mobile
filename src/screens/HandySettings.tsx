import * as bip39 from 'bip39'
import * as crypto from 'crypto'
import { HDNode } from '@ethersproject/hdnode'
import * as R from 'ramda'
import React, { useCallback, useEffect, useRef, useState } from "react"
import { ActivityIndicator, Alert, Button, Linking, Modal, SafeAreaView, ScrollView, Text, TextInput, TouchableHighlight, View } from "react-native"
import { CheckBox } from "react-native-elements"
import { classToPlain } from "class-transformer"
import QRCode from "react-native-qrcode-svg"
import Clipboard from "@react-native-community/clipboard"
import VersionNumber from 'react-native-version-number'
import { useSelector } from 'react-redux'
import { IIdentifier } from "@veramo/core"

import * as pkg from '../../package.json'
import { MASTER_COLUMN_VALUE, Settings } from "../entity/settings"
import * as utility from "../utility/utility"
import { appSlice, appStore, DEFAULT_ENDORSER_API_SERVER, DEFAULT_ENDORSER_VIEW_SERVER, LOCAL_ENDORSER_API_SERVER, LOCAL_ENDORSER_VIEW_SERVER, TEST_ENDORSER_API_SERVER, TEST_ENDORSER_VIEW_SERVER } from "../veramo/appSlice"
import { agent, dbConnection, DEFAULT_DID_PROVIDER_NAME } from "../veramo/setup"
import { styles } from './style'

// from https://github.com/uport-project/veramo/discussions/346#discussioncomment-302234
const UPORT_ROOT_DERIVATION_PATH = "m/7696500'/0'/0'/0'"

const TEST_API_URL = 'https://test.endorser.ch:8000'
const TEST_VIEW_URL = 'https://test.endorser.ch:8080'

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
const importAndStoreIdentifier = async (mnemonic: string, mnemonicPassword: string, toLowercase: boolean, previousIdentifiers: Array<IIdentifier>) => {

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
  const rootNode: HDNode = hdnode.derivePath(UPORT_ROOT_DERIVATION_PATH)
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

  const newId = newIdentifier(address, publicHex, privateHex, UPORT_ROOT_DERIVATION_PATH)
  appStore.dispatch(appSlice.actions.addLog({log: false, msg: "... created new ID..."}))

  // awaiting because otherwise the UI may not see that a mnemonic was created
  const savedId = await storeIdentifier(newId, mnemonic, mnemonicPassword)
  appStore.dispatch(appSlice.actions.addLog({log: false, msg: "... stored new ID..."}))
  return savedId
}

// Create a totally new ID
const createAndStoreIdentifier = async (mnemonicPassword) => {

  // This doesn't give us the entropy/seed.
  //const id = await agent.didManagerCreate()

  const entropy = crypto.randomBytes(32)
  const mnemonic = bip39.entropyToMnemonic(entropy)
  appStore.dispatch(appSlice.actions.addLog({log: false, msg: "... generated mnemonic..."}))

  return importAndStoreIdentifier(mnemonic, mnemonicPassword, false, [])
}

const logDatabaseTable = (tableName) => async () => {
  const conn = await dbConnection
  const data = await conn.manager.query('SELECT * FROM ' + tableName)
  if (tableName === 'settings') {
    data[0]['mnemEncrBase64'] = 'HIDDEN'
  }
  appStore.dispatch(appSlice.actions.addLog({log: true, msg: "Contents of table \"" + tableName + "\":\n" + JSON.stringify(data)}))
}

export function HandySettingsScreen({navigation}) {

  const [confirmDeleteLastIdentifier, setConfirmDeleteLastIdentifier] = useState<boolean>(false)
  const [createStatus, setCreateStatus] = useState<string>('')
  const [creatingId, setCreatingId] = useState<boolean>(false)
  const [error, setError] = useState<string>('')
  const [finishedCheckingIds, setFinishedCheckingIds] = useState<boolean>(false)
  const [hasMnemonic, setHasMnemonic] = useState<boolean>(false)
  const [isInAdvancedMode, setIsInAdvancedMode] = useState<boolean>(appStore.getState().advancedMode)
  const [isInTestMode, setIsInTestMode] = useState<boolean>(appStore.getState().testMode)
  const [inputApiServer, setInputApiServer] = useState<string>(appStore.getState().settings.apiServer)
  const [inputName, setInputName] = useState<string>('')
  const [lastNotifiedClaimId, setLastNotifiedClaimId] = useState<string>(appStore.getState().settings.lastNotifiedClaimId)
  const [lastViewedClaimId, setLastViewedClaimId] = useState<string>(appStore.getState().settings.lastViewedClaimId)
  const [mnemonicPassword, setMnemonicPassword] = useState<string>('')
  const [qrJwts, setQrJwts] = useState<Record<string,string>>({})
  const [quickMessage, setQuickMessage] = useState<string>(null)
  const [showPrivateKey, setShowPrivateKey] = useState<boolean>(false)
  const [storedApiServer, setStoredApiServer] = useState<string>(appStore.getState().settings.apiServer)
  const [storedName, setStoredName] = useState<string>('')

  const identifiersSelector = useSelector((state) => state.identifiers || [])
  const homeScreenSelector = useSelector((state) => (state.settings || {}).homeScreen)
  const logMessageSelector = useSelector((state) => state.logMessage)

  const toggleStateForHomeIsBVC = async () => {
    const newValue = homeScreenSelector == null ? 'BVC' : null
    const conn = await dbConnection
    await conn.manager.save(Settings, { id: MASTER_COLUMN_VALUE, homeScreen: newValue })
    appStore.dispatch(appSlice.actions.setHomeScreen(newValue))
  }

  const toggleAdvancedMode = () => {
    if (isInTestMode && isInAdvancedMode) {
      Alert.alert('You must uncheck Test Mode to exit Advanced Mode.')
    } else {
      const newValue = !isInAdvancedMode
      setIsInAdvancedMode(newValue)
      appStore.dispatch(appSlice.actions.setAdvancedMode(newValue))
    }
  }

  const inputViewRef = useRef()
  const setToLocalServers = useCallback(async () => {
    inputViewRef.current.setNativeProps({ text: LOCAL_ENDORSER_VIEW_SERVER })
    // even with onChangeText on the useRef instance, the appStore setting isn't changed so we need these
    const conn = await dbConnection
    await conn.manager.update(Settings, MASTER_COLUMN_VALUE, { apiServer: LOCAL_ENDORSER_API_SERVER })
    const settings = classToPlain(appStore.getState().settings)
    settings.apiServer = LOCAL_ENDORSER_API_SERVER
    appStore.dispatch(appSlice.actions.setSettings(settings))
    appStore.dispatch(appSlice.actions.setViewServer(LOCAL_ENDORSER_VIEW_SERVER))
    setInputApiServer(LOCAL_ENDORSER_API_SERVER)
    setStoredApiServer(LOCAL_ENDORSER_API_SERVER)
  })
  const setToTestServers = useCallback(async () => {
    inputViewRef.current.setNativeProps({ text: TEST_ENDORSER_VIEW_SERVER })
    // even with onChangeText on the useRef instance, the appStore setting isn't changed so we need these
    const conn = await dbConnection
    await conn.manager.update(Settings, MASTER_COLUMN_VALUE, { apiServer: TEST_ENDORSER_API_SERVER })
    const settings = classToPlain(appStore.getState().settings)
    settings.apiServer = TEST_ENDORSER_API_SERVER
    appStore.dispatch(appSlice.actions.setSettings(settings))
    appStore.dispatch(appSlice.actions.setViewServer(TEST_ENDORSER_VIEW_SERVER))
    setInputApiServer(TEST_ENDORSER_API_SERVER)
    setStoredApiServer(TEST_ENDORSER_API_SERVER)
  })
  const setToProdServers = useCallback(async () => {
    inputViewRef.current.setNativeProps({ text: DEFAULT_ENDORSER_VIEW_SERVER })
    // even with onChangeText on the useRef instance, the appStore setting isn't changed so we need these
    const conn = await dbConnection
    await conn.manager.update(Settings, MASTER_COLUMN_VALUE, { apiServer: DEFAULT_ENDORSER_API_SERVER })
    const settings = classToPlain(appStore.getState().settings)
    settings.apiServer = DEFAULT_ENDORSER_API_SERVER
    appStore.dispatch(appSlice.actions.setSettings(settings))
    appStore.dispatch(appSlice.actions.setViewServer(DEFAULT_ENDORSER_VIEW_SERVER))
    setInputApiServer(DEFAULT_ENDORSER_API_SERVER)
    setStoredApiServer(DEFAULT_ENDORSER_API_SERVER)
  })

  const persistApiServer = async () => {
    const conn = await dbConnection
    // may be empty string, but we don't want that in the DB
    const valueToSave = inputApiServer || null
    const settings = await conn.manager.update(Settings, MASTER_COLUMN_VALUE, { apiServer: valueToSave })
    appStore.dispatch(appSlice.actions.setSettings(classToPlain(settings)))
    setStoredApiServer(inputApiServer)
  }

  const deleteLastIdentifier = async () => {
    if (identifiersSelector.length > 0) {
      const oldIdent = identifiersSelector[identifiersSelector.length - 1]
      await agent.didManagerDelete(oldIdent)
      if (identifiersSelector.length === 1) {
        const conn = await dbConnection
        await conn.manager.update(Settings, MASTER_COLUMN_VALUE, {mnemEncrBase64: null, ivBase64: null, salt: null})
      }

      const ids = await agent.didManagerFind()
      appStore.dispatch(appSlice.actions.setIdentifiers(ids.map(classToPlain)))
      setQrJwts(jwts => R.omit([oldIdent.did], jwts))
    }
  }

  const setNewId = async (ident) => {
    const pojoIdent = classToPlain(ident)
    appStore.dispatch(appSlice.actions.addIdentifier(pojoIdent))

    const conn = await dbConnection
    let settings = await conn.manager.findOne(Settings, MASTER_COLUMN_VALUE)
    if (settings && (settings.mnemEncrBase64 || settings.mnemonic)) {
      setHasMnemonic(true)
    }

    setQrJwtForPayload(ident, inputName)
  }

  const storeNewName = async () => {
    const conn = await dbConnection
    await conn.manager.update(Settings, MASTER_COLUMN_VALUE, {name: inputName})
    identifiersSelector.forEach(ident => {
      setQrJwtForPayload(ident, inputName)
    })
    setStoredName(inputName)
  }

  const setQrJwtForPayload = async (identifier, name) => {
    // The public key should always exist, but we've seen Veramo weirdness
    // where an entry in the key table with a lowercase DID will be overwritten
    // by one with mixed case but the associated entry in the identifier table
    // will remain (so one identifier will not have an associated key). Ug.
    if (identifier.keys[0] && identifier.keys[0].publicKeyHex && identifier.keys[0].privateKeyHex) {
      try {
        const sharePayload = uportJwtPayload(identifier.did, name, identifier.keys[0].publicKeyHex)

        const newJwt = await utility.createJwt(identifier, sharePayload)
        const viewPrefix = appStore.getState().viewServer + utility.ENDORSER_JWT_URL_LOCATION
        const qrJwt = viewPrefix + newJwt
        setQrJwts(jwts => R.set(R.lensProp(identifier.did), qrJwt, jwts))
      } catch (err) {
        appStore.dispatch(appSlice.actions.addLog({log: true, msg: "Got error setting JWT contents for contact: " + err}))
      }
    }
  }

  const copyToClipboard = (value) => {
    Clipboard.setString(value)
    setQuickMessage('Copied')
    setTimeout(() => { setQuickMessage(null) }, 1000)
  }

  const storeLastNotifiedClaimId = async (value) => {
    const conn = await dbConnection
    await conn.manager.update(Settings, MASTER_COLUMN_VALUE, { lastNotifiedClaimId: value })

    const settings = classToPlain(appStore.getState().settings)
    settings.lastNotifiedClaimId = value
    appStore.dispatch(appSlice.actions.setSettings(settings))

    setLastNotifiedClaimId(value)

    if (value < lastViewedClaimId) {
      Alert.alert('Last Notified < Last Viewed. Confusing... make them equal.')
    }
  }

  const storeLastViewedClaimId = async (value) => {
    const conn = await dbConnection
    await conn.manager.update(Settings, MASTER_COLUMN_VALUE, { lastNotifiedClaimId: value, lastViewedClaimId: value })

    const settings = classToPlain(appStore.getState().settings)
    settings.lastNotifiedClaimId = value
    settings.lastViewedClaimId = value
    appStore.dispatch(appSlice.actions.setSettings(settings))

    setLastNotifiedClaimId(value)
    setLastViewedClaimId(value)
  }

  // Check for existing identifers on load and set them to state
  useEffect(() => {
    const getIdentifiers = async () => {
      const pojoIds = appStore.getState().identifiers

      const conn = await dbConnection
      let settings = await conn.manager.findOne(Settings, MASTER_COLUMN_VALUE)
      if (settings && (settings.mnemEncrBase64 || settings.mnemonic)) {
        setHasMnemonic(true)
      }
      if (settings && settings.name) {
        setStoredName(settings.name)
        setInputName(settings.name)
      }

      pojoIds.forEach(ident => {
        setQrJwtForPayload(ident, settings && settings.name)
      })
      setFinishedCheckingIds(true)
    }
    getIdentifiers()
  }, []) // Why does this loop infinitely with any variable, even with classToPlain(identifiers) that doesn't change?

  useEffect(() => {
    const createIdentifier = async () => {
      appStore.dispatch(appSlice.actions.addLog({log: true, msg: "Creating new identifier..."}))
      createAndStoreIdentifier(mnemonicPassword)
      .then(setNewId)
      .then(() => {
        setCreatingId(false)
        setError("")
        appStore.dispatch(appSlice.actions.addLog({log: true, msg: "... totally finished creating identifier."}))
      })
      .catch(err => {
        appStore.dispatch(appSlice.actions.addLog({log: true, msg: "... got error creating identifier: " + err}))
        setError("There was an error. " + err)
      })
    }
    if (creatingId) {
      createIdentifier()
    }
  }, [creatingId])

  useEffect(() => {
    // This is the wrong approach because setting this flag multiple times will
    // cause multiple warning messages.
    const setNewTestMode = async (setting) => {
      appStore.dispatch(appSlice.actions.setTestMode(setting))
      if (setting) {
        Alert.alert('You can lose data in Test Mode. If unsure: exit, or restart the app.')
      } else {
        // now going into real mode, but if the servers were switched then warn
        if (appStore.getState().settings.apiServer !== DEFAULT_ENDORSER_API_SERVER
            || appStore.getState().viewServer !== DEFAULT_ENDORSER_VIEW_SERVER) {
          Alert.alert('Beware! Your servers are not set to the default production servers.')
        }
      }
    }
    setNewTestMode(isInTestMode)
  }, [isInTestMode])

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
                <Button title="Save (currently not saved)" onPress={storeNewName} />
                <View style={{ backgroundColor: 'rgba(0,0,0,0.9)', height: 0.8, width: '100%', marginBottom: 20 }}/>
              </View>
            }
          </View>
          <View>
            <Text style={{ padding: 10, color: 'red', textAlign: 'center' }}>{ error }</Text>
            {
              R.isEmpty(identifiersSelector)
              ?
                finishedCheckingIds
                ?
                  <View>
                    <Text style={{ marginTop: 10 }}>There are no identifiers.</Text>
                    { creatingId
                      ? <View>
                        <Text>{createStatus}</Text>
                        <ActivityIndicator size="large" color="#00ff00" />
                      </View>
                      : <View>
                        <Button title="Create Identifier" onPress={() => { setCreatingId(true) }} />
                        <Text>... and guard seed phrase with password:</Text>
                        <TextInput
                          autoCapitalize={'none'}
                          defaultValue={ mnemonicPassword }
                          onChangeText={ setMnemonicPassword }
                          style={{borderWidth: 1}}
                          textContentType={'newPassword'}
                        />
                      </View>
                    }
                  </View>
                :
                  <View><Text>Checking for identifiers...</Text></View>
              :
                <View>

                  {
                  !hasMnemonic ? (
                    <Text style={{ padding: 10, color: 'red' }}>There is no backup available for this ID. We recommend you generate a different identifier and do not keep using this one. (See Help.)</Text>
                  ) : (
                     <Text/>
                  )
                  }

                  {
                  identifiersSelector.map(ident =>
                    <View key={ident.did} style={{ marginTop: 20 }}>

                      <Text>Identifier</Text>
                      <Text style={{ fontSize: 11, marginBottom: 20 }} selectable={true}>
                        { ident.did }
                      </Text>

                      {
                      ident.keys[0] == null ? (
                        <Text style={{ color: 'red' }}>That identifier has no keys, and therefore it cannot be used for signing or verification.</Text>
                      ) : (
                      ident.keys[0].publicKeyHex == null ? (
                        <Text style={{ color: 'red' }}>That identifier has no public key, and therefore it cannot be verified.</Text>
                      ) : (

                      ident.keys[0].privateKeyHex == null ? (
                        <Text style={{ color: 'red' }}>That identifier has no private key, and therefore it cannot be used for signing.</Text>
                      ) : (

                        <View>

                          <QRCode value={qrJwts[ident.did]} size={300}/>

                          <Text style={{ color: 'blue', textAlign: 'right' }} onPress={() => Linking.openURL(qrJwts[ident.did])}>
                            View Online
                          </Text>

                          <Text style={{ color: 'blue', textAlign: 'right' }} onPress={() => copyToClipboard(qrJwts[ident.did])}>
                            Copy to Clipboard
                          </Text>

                          <Text>Public Key (base64)</Text>
                          <Text style={{ marginBottom: 20 }} selectable={true}>
                            { Buffer.from(ident.keys[0].publicKeyHex, 'hex').toString('base64') }
                          </Text>

                          <Text>Public Key (hex)</Text>
                          <Text style={{ marginBottom: 20 }} selectable={true}>
                            { ident.keys[0].publicKeyHex }
                          </Text>

                          <Text>Derivation Path</Text>
                          <Text style={{ marginBottom: 20 }} selectable={true}>
                            { ident.keys[0].meta && ident.keys[0].meta.derivationPath ? ident.keys[0].meta.derivationPath : 'Unknown. Probably: ' + UPORT_ROOT_DERIVATION_PATH }
                          </Text>

                          <View>
                            <CheckBox
                              title='Show Private Key'
                              checked={showPrivateKey}
                              onPress={() => setShowPrivateKey(!showPrivateKey)}
                            />
                          </View>
                          {
                            showPrivateKey
                            ?
                              <View>
                                <Text>Private Key (hex)</Text>
                                <Text style={{ marginBottom: 20 }} selectable={true}>
                                  { ident.keys[0].privateKeyHex }
                                </Text>
                              </View>
                            :
                              <View/>
                          }

                        </View>

                      )
                      )
                      )
                      }

                    </View>
                  )
                  }

                  <View style={{ marginTop: 20, marginBottom: 20 }}>
                    <Button
                    title="Export Seed Phrase"
                    onPress={() => navigation.navigate('Export Seed Phrase')}
                    />
                  </View>
                </View>
            }

            { isInTestMode
              ? <View style={{ marginTop: 20 }}>
                  <Button title="Create Identifier" onPress={()=>{setCreatingId(true)}} />
                  <Text>... and guard seed phrase with password:</Text>
                  <TextInput
                    autoCapitalize={'none'}
                    defaultValue={ mnemonicPassword }
                    onChangeText={ setMnemonicPassword }
                    style={{borderWidth: 1}}
                    textContentType={'newPassword'}
                  />
                  <View style={{ padding: 5 }} />
                  <Button title="Import ID" onPress={()=>navigation.navigate('Import Seed Phrase')} />
                  <View style={{ padding: 5 }} />
                  <Button title="Delete Last ID" onPress={() => setConfirmDeleteLastIdentifier(true)} />
                </View>
              : <View/>
            }
          </View>

          <Modal
            animationType="slide"
            transparent={true}
            visible={!!quickMessage}
          >
            <View style={styles.centeredView}>
              <View style={styles.modalView}>
                <Text>{ quickMessage }</Text>
              </View>
            </View>
          </Modal>

          {/* Note that something similar is in Contacts.tsx... almost time to abstract it. */}
          <Modal
            animationType="slide"
            transparent={true}
            visible={!!confirmDeleteLastIdentifier}
          >
            <View style={styles.centeredView}>
              <View style={styles.modalView}>

                <Text>
                  Are you sure you want to delete the last identifier? This cannot be undone.
                </Text>

                <View style={{ padding: 5 }}/>
                <TouchableHighlight
                  style={styles.cancelButton}
                  onPress={() => {
                    deleteLastIdentifier()
                    setConfirmDeleteLastIdentifier(false)

                    setQuickMessage('Deleted')
                    setTimeout(() => { setQuickMessage(null) }, 2000)
                  }}
                >
                  <Text>Yes</Text>
                </TouchableHighlight>

                <View style={{ padding: 5 }}/>
                <TouchableHighlight
                  style={styles.saveButton}
                  onPress={() => {
                    setConfirmDeleteLastIdentifier(false)
                  }}
                >
                  <Text>No</Text>
                </TouchableHighlight>
              </View>
            </View>
          </Modal>

          <View style={{ marginBottom: 50 }}>
            <Text style={{ fontSize: 30, fontWeight: 'bold', marginTop: 20 }}>Other</Text>

            <View>
              <Text selectable={true}>Version { pkg.version } ({ VersionNumber.buildVersion })</Text>
            </View>

            <View style={{ marginTop: 20, padding: 10 }}>
              <Text
                style={{ color: 'blue' }}
                onPress={() => navigation.navigate('Notification Permissions')}
              >
                Check Permissions
              </Text>
            </View>

            <View style={{ marginTop: 20, padding: 10 }}>
              <Text>Home Screen</Text>
              <CheckBox
                title='Bountiful Voluntaryist Community'
                checked={homeScreenSelector === 'BVC'}
                onPress={toggleStateForHomeIsBVC}
              />
            </View>

            <CheckBox
              title='Advanced Mode'
              checked={isInAdvancedMode}
              onPress={toggleAdvancedMode}
            />

            {
            isInAdvancedMode
            ? (
              <View>

                <Text>Endorser API Server</Text>
                <TextInput
                  value={inputApiServer ? inputApiServer : ''}
                  onChangeText={setInputApiServer}
                  style={{borderWidth: 1}}
                />
                {
                  inputApiServer !== storedApiServer
                  ? (
                    () => {
                    return <Button
                      title='Save (currently not saved)'
                      onPress={persistApiServer}
                    />
                    }
                  )() :
                    <View />
                }

                <CheckBox
                  title='Test Mode'
                  checked={isInTestMode}
                  onPress={() => {setIsInTestMode(!isInTestMode)}}
                />

                {
                isInTestMode
                ? (
                  <View style={{ padding: 10 }}>
                    <Text>Endorser View Server</Text>
                    <TextInput
                      defaultValue={ appStore.getState().viewServer }
                      onChangeText={(text) => {
                        appStore.dispatch(appSlice.actions.setViewServer(text))
                      }}
                      ref={inputViewRef}
                      style={{borderWidth: 1}}
                    >
                    </TextInput>

                    <View style={{ padding: 5 }} />
                    <Button
                      title='Use public prod servers'
                      onPress={setToProdServers}
                    />
                    <View style={{ marginTop: 5 }}/>
                    <Button
                      title='Use public test servers'
                      onPress={setToTestServers}
                    />
                    <View style={{ marginTop: 5 }}/>
                    <Button
                      title='Use local test servers'
                      onPress={setToLocalServers}
                    />

                    <Text>Last Notified Claim ID</Text>
                    <TextInput
                      value={lastNotifiedClaimId || ''}
                      onChangeText={storeLastNotifiedClaimId}
                      style={{borderWidth: 1}}
                    />

                    <Text>Last Viewed Claim ID</Text>
                    <TextInput
                      value={lastViewedClaimId || ''}
                      onChangeText={storeLastViewedClaimId}
                      style={{borderWidth: 1}}
                    />

                  </View>
                ) : (
                  <View/>
                )}

                <Button
                  title='Log Contact Table'
                  onPress={logDatabaseTable('contact')}
                />
                <View style={{ marginTop: 5 }}/>
                <Button
                  title='Log Identifier Table'
                  onPress={logDatabaseTable('identifier')}
                />
                <View style={{ marginTop: 5 }}/>
                <Button
                  title='Log Key Table'
                  onPress={logDatabaseTable('key')}
                />
                <View style={{ marginTop: 5 }}/>
                <Button
                  title='Log Settings Table'
                  onPress={logDatabaseTable('settings')}
                />

                <Text>Log</Text>
                <Text selectable={true}>{ logMessageSelector }</Text>
              </View>
            ) : (
              <View/>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

export function HandyExportIdentityScreen({navigation}) {
  const [error, setError] = useState<String>('')
  const [hasMnemonic, setHasMnemonic] = useState<boolean>(false)
  const [isInTestMode] = useState<boolean>(appStore.getState().testMode)
  const [mnemonic, setMnemonic] = useState<String>('')
  const [mnemonicPassword, setMnemonicPassword] = useState<string>('')
  const [show, setShow] = useState<String>(false)

  const copyToClipboard = () => {
    Clipboard.setString(mnemonic)
  }

  // Check for existing identifers on load and set them to state
  useEffect(() => {
    const getMnemonicFromDB = async () => {
      const conn = await dbConnection
      const settings = await conn.manager.findOne(Settings, MASTER_COLUMN_VALUE)
      setHasMnemonic(settings.mnemEncrBase64 != null || settings.mnemonic != null)
    }
    getMnemonicFromDB()
  }, [])

  const decryptAndShow = async () => {
    setError('')

    const conn = await dbConnection
    const settings = await conn.manager.findOne(Settings, MASTER_COLUMN_VALUE)
    if (settings.mnemEncrBase64 != null) {
      try {
        const mnemonic = utility.decryptFromBase64(settings.mnemEncrBase64, mnemonicPassword, settings.salt, settings.ivBase64);
        setMnemonic(mnemonic)
        setShow(true)
      } catch (err) {
        setError('Decryption failed. Check your password.')
        appStore.dispatch(appSlice.actions.addLog({log: true, msg: "Unable to retrieve mnemonic because: " + err}))
      }
    } else if (settings.mnemonic != null) {
      // because we still have some people who have unencrypted seeds in their DB
      setMnemonic(settings.mnemonic)
      setShow(true)
    } else {
      setError('No mnemonic found.')
    }
  }

  return (
    <View style={{padding: 20}}>
      <View style={{marginBottom: 50, marginTop: 20}}>
        {hasMnemonic ? (

          <View>
            <Text>BEWARE: Anyone who gets hold of this mnemonic seed phrase will be able to impersonate you and
              take over any digital holdings based on it. So only reveal it when you are in a
              private place out of sight of cameras and other eyes, and only record it in
              something private -- don't take a screenshot or send it to any online
              service.</Text>
            {show ? (
              <View>
                <TextInput
                  multiline={true}
                  style={{borderWidth: 1, height: 100}}
                >
                  {mnemonic}
                </TextInput>
                {isInTestMode ? (
                  <Button
                    title="Copy to Clipboard"
                    onPress={copyToClipboard}
                  />
                ) : (
                  <View />
                )}
              </View>
            ) : (
              <View>
                <Button title={'Click to show mnemonic seed phrase'} onPress={decryptAndShow}/>
                <Text>... and unlock seed phrase with password:</Text>
                <TextInput
                  autoCapitalize={'none'}
                  defaultValue={ mnemonicPassword }
                  onChangeText={ setMnemonicPassword }
                  secureTextEntry={true}
                  style={{borderWidth: 1}}
                  textContentType={'password'}
                />

              </View>
            )}
          </View>
        ) : (
          <View>
            <Text>There is no mnemonic seed phrase to export.</Text>
          </View>
        )}
        <Text style={{ padding: 10, color: 'red', textAlign: 'center' }}>
          {error}
        </Text>
      </View>
    </View>
  )
}

export function HandyImportIdentityScreen({navigation}) {
  const [error, setError] = useState<string>('')
  const [idChanged, setIdChanged] = useState<boolean>(false)
  const [idImporting, setIdImporting] = useState<boolean>(false)
  const [makeLowercase, setMakeLowercase] = useState<boolean>(false)
  const [mnemonic, setMnemonic] = useState<String>('')
  const [mnemonicIsOld, setMnemonicIsOld] = useState<boolean>(false)
  const [mnemonicPassword, setMnemonicPassword] = useState<string>('')

  const identifiersSelector = useSelector((state) => state.identifiers || [])

  useEffect(() => {
    const loadOldMnemonic = async () => {
      const conn = await dbConnection
      const settings = await conn.manager.findOne(Settings, MASTER_COLUMN_VALUE)
      if (settings && settings.mnemonic != null) {
        setMnemonic(settings.mnemonic)
        setMnemonicIsOld(true)
      }
    }
    loadOldMnemonic()
  })

  useEffect(() => {
    const coordImportId = async () => {
      appStore.dispatch(appSlice.actions.addLog({log: true, msg: "Importing identifier..."}))

      importAndStoreIdentifier(mnemonic, mnemonicPassword, makeLowercase, identifiersSelector)
      .then(newIdentifier => {
        appStore.dispatch(appSlice.actions.addLog({log: true, msg: "... totally finished importing identifier."}))
        setIdChanged(true)

        // one reason redirect automatically is to force reload of ID (which doen't show if they go "back")
        setTimeout(() => {
          // if we goBack or popToTop then the home screen doesn't see the new ID
          navigation.reset({ index: 0, routes: [{ name: "Goodlaw Signatures" }] })
        }, 500)
      })
      .catch(err => {
        appStore.dispatch(appSlice.actions.addLog({log: true, msg: "... got error importing identifier: " + err}))
        setError("There was an error. " + err)
      })
      .finally(() => {
        setIdImporting(false)
      })
    }
    if (idImporting) {
      coordImportId()
    }
  }, [idImporting])

  const setNewMnemonic = (mnemonic: string) => {
    setMnemonic(mnemonic)
    setMnemonicIsOld(false)
  }

  return (
    <SafeAreaView>
      <ScrollView>
        <View style={{padding: 20}}>
          <Text style={{fontSize: 30, fontWeight: 'bold'}}>Mnemonic Seed Phrase</Text>
          <View style={{marginBottom: 50, marginTop: 20}}>
          {
            idImporting ? (
              <ActivityIndicator size="large" color="#00ff00" />
            ) : (
              idChanged ? (
                <Text style={{fontSize: 30}}>Success!</Text>
              ) : (
                  <View>
                    {mnemonicIsOld ? (
                      <Text style={{ color: 'red' }}>Seed phrase is not protected, so "click to import" below to protect it.</Text>
                    ) : (
                      <View />
                    )}
                    <Text>Enter mnemonic seed phrase:</Text>
                    <TextInput
                      autoCapitalize={'none'}
                      multiline={true}
                      style={{borderWidth: 1, height: 100}}
                      defaultValue={ mnemonic }
                      onChangeText={ setNewMnemonic }
                    >
                    </TextInput>
                    <Text>... and guard seed phrase with password:</Text>
                    <TextInput
                      autoCapitalize={'none'}
                      defaultValue={ mnemonicPassword }
                      onChangeText={ setMnemonicPassword }
                      style={{borderWidth: 1}}
                      textContentType={'newPassword'}
                    />
                    <CheckBox
                      title='Convert Address to Lowercase -- Check this if you used the original uPort app.'
                      checked={makeLowercase}
                      onPress={() => setMakeLowercase(!makeLowercase)}
                    />
                    <Text>Note that this will also create an identifier with the default uPort derivation path.</Text>
                    <Button
                      title={'Click to import from mnemonic seed phrase'}
                      onPress={()=>setIdImporting(true)}
                    />
                    {error ? (
                      <Text style={{ color: 'red', textAlign: 'center' }}>{ error }</Text>
                    ) : (
                      <View />
                    )}
                  </View>
              )
            )
          }
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}