import * as bip39 from 'bip39'
import * as crypto from 'crypto'
import { HDNode } from '@ethersproject/hdnode'
import * as R from 'ramda'
import React, { useCallback, useEffect, useRef, useState } from "react"
import { ActivityIndicator, Alert, Button, Linking, Modal, SafeAreaView, ScrollView, Text, TextInput, View } from "react-native"
import { CheckBox } from "react-native-elements"
import { classToPlain } from "class-transformer"
import QRCode from "react-native-qrcode-svg"
import Clipboard from "@react-native-community/clipboard"
import VersionNumber from 'react-native-version-number'
import { IIdentifier } from "@veramo/core"

import * as pkg from '../../package.json'
import { MASTER_COLUMN_VALUE, Settings } from "../entity/settings"
import * as utility from "../utility/utility"
import { DEFAULT_ENDORSER_API_SERVER, DEFAULT_ENDORSER_VIEW_SERVER, appSlice, appStore } from "../veramo/appSlice"
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

    let newContact = await conn.manager.save(settings)
    appStore.dispatch(appSlice.actions.addLog({log: false, msg: "... mnemonic saved..."}))

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

// Import and existing ID
const importAndStoreIdentifier = async (mnemonic: string, mnemonicPassword: string, toLowercase: boolean) => {

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
  const privateHex = rootNode.privateKey.substring(2)
  const publicHex = rootNode.privateKey.substring(2)
  let address = rootNode.address
  if (toLowercase) {
    address = address.toLowerCase()
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

  return importAndStoreIdentifier(mnemonic, mnemonicPassword, false)
}

const logDatabaseTable = (tableName) => async () => {
  const conn = await dbConnection
  const data = await conn.manager.query('SELECT * FROM ' + tableName)
  appStore.dispatch(appSlice.actions.addLog({log: true, msg: "Contents of table \"" + tableName + "\":\n" + JSON.stringify(data)}))
}

export function SettingsScreen({navigation}) {

  const [createStatus, setCreateStatus] = useState<string>('')
  const [creatingId, setCreatingId] = useState<boolean>(false)
  const [error, setError] = useState<string>('')
  const [finishedCheckingIds, setFinishedCheckingIds] = useState<boolean>(false)
  const [hasMnemonic, setHasMnemonic] = useState<boolean>(false)
  const [homeIsBVC, setHomeIsBVC] = useState<boolean>(false)
  const [identifiers, setIdentifiers] = useState<Omit<IIdentifier, 'provider'>[]>([])
  const [isInAdvancedMode, setIsInAdvancedMode] = useState<boolean>(appStore.getState().advancedMode)
  const [isInTestMode, setIsInTestMode] = useState<boolean>(appStore.getState().testMode)
  const [inputName, setInputName] = useState<string>('')
  const [mnemonicPassword, setMnemonicPassword] = useState<string>('')
  const [qrJwts, setQrJwts] = useState<Record<string,string>>({})
  const [quickMessage, setQuickMessage] = useState<string>(null)
  const [storedName, setStoredName] = useState<string>('')

  const toggleStateForHomeIsBVC = async () => {
    if (homeIsBVC) {
      appStore.dispatch(appSlice.actions.setHomeScreen(null))
      const conn = await dbConnection
      await conn.manager.update(Settings, MASTER_COLUMN_VALUE, { homeScreen: null })
      setHomeIsBVC(false)
    } else {
      appStore.dispatch(appSlice.actions.setHomeScreen('BVC'))
      const conn = await dbConnection
      await conn.manager.update(Settings, MASTER_COLUMN_VALUE, { homeScreen: 'BVC' })
      setHomeIsBVC(true)
    }
  }

  const toggleAdvancedMode = () => {
    if (isInTestMode) {
      Alert.alert('You must uncheck Test Mode to exit Advanced Mode.')
    } else {
      const newValue = !isInAdvancedMode
      setIsInAdvancedMode(newValue)
      appStore.dispatch(appSlice.actions.setAdvancedMode(newValue))
    }
  }

  // from https://reactnative.dev/docs/direct-manipulation#setnativeprops-to-clear-textinput-value
  const inputApiRef = useRef()
  const inputViewRef = useRef()
  const setToLocalServers = useCallback(() => {
    inputApiRef.current.setNativeProps({ text: 'http://127.0.0.1:3000' })
    inputViewRef.current.setNativeProps({ text: 'http://127.0.0.1:3001' })
    appStore.dispatch(appSlice.actions.setApiServer('http://127.0.0.1:3000'))
    appStore.dispatch(appSlice.actions.setViewServer('http://127.0.0.1:3001'))
  })
  const setToTestServers = useCallback(() => {
    inputApiRef.current.setNativeProps({ text: TEST_API_URL })
    inputViewRef.current.setNativeProps({ text: TEST_VIEW_URL })
    appStore.dispatch(appSlice.actions.setApiServer(TEST_API_URL))
    appStore.dispatch(appSlice.actions.setViewServer(TEST_VIEW_URL))
  })
  const setToProdServers = useCallback(() => {
    inputApiRef.current.setNativeProps({ text: DEFAULT_ENDORSER_API_SERVER })
    inputViewRef.current.setNativeProps({ text: DEFAULT_ENDORSER_VIEW_SERVER })
    appStore.dispatch(appSlice.actions.setApiServer(DEFAULT_ENDORSER_API_SERVER))
    appStore.dispatch(appSlice.actions.setViewServer(DEFAULT_ENDORSER_VIEW_SERVER))
  })

  const deleteLastIdentifier = async () => {
    if (identifiers.length > 0) {
      const oldIdent = identifiers[identifiers.length - 1]
      await agent.didManagerDelete(oldIdent)
      if (identifiers.length === 1) {
        const conn = await dbConnection
        await conn.manager.update(Settings, MASTER_COLUMN_VALUE, {mnemEncrBase64: null, ivBase64: null, salt: null})
      }
      const ids = await agent.didManagerFind()
      appStore.dispatch(appSlice.actions.setIdentifiers(ids.map(classToPlain)))
      setIdentifiers(ids)
      setQrJwts(jwts => R.omit([oldIdent.did], jwts))
    }
  }

  const setNewId = async (ident) => {
    const pojoIdent = classToPlain(ident)
    appStore.dispatch(appSlice.actions.addIdentifier(pojoIdent))
    setIdentifiers((s) => s.concat([pojoIdent]))

    const conn = await dbConnection
    let settings = await conn.manager.findOne(Settings, MASTER_COLUMN_VALUE)
    if (settings?.mnemEncrBase64 || settings?.mnemonic) {
      setHasMnemonic(true)
    }

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
    const viewPrefix = appStore.getState().viewServer + utility.ENDORSER_JWT_URL_LOCATION
    const qrJwt = viewPrefix + newJwt
    setQrJwts(jwts => R.set(R.lensProp(identifier.did), qrJwt, jwts))
  }

  const copyToClipboard = (value) => {
    Clipboard.setString(value)
    setQuickMessage('Copied')
    setTimeout(() => { setQuickMessage(null) }, 1000)
  }

  // Check for existing identifers on load and set them to state
  useEffect(() => {
    const getIdentifiers = async () => {
      const pojoIds = appStore.getState().identifiers
      appStore.dispatch(appSlice.actions.setIdentifiers(pojoIds))
      setIdentifiers(pojoIds)

      const conn = await dbConnection
      let settings = await conn.manager.findOne(Settings, MASTER_COLUMN_VALUE)
      if (settings?.mnemEncrBase64 || settings?.mnemonic) {
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
        Alert.alert('Beware! In test mode you have the ability to corrupt your data. If you are unsure, exit test mode or close and restart the app.')
      } else {
        // now going into real mode, but if the servers were switched then warn
        if (appStore.getState().apiServer !== DEFAULT_ENDORSER_API_SERVER) {
          Alert.alert('Beware! Your servers are not set to the default production servers.')
        }
      }
    }
    setNewTestMode(isInTestMode)
  }, [isInTestMode])

  useEffect(() => {
    setHomeIsBVC(appStore.getState().settings.homeScreen)
  })

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
          <View>
            <Text style={{ padding: 10, color: 'red', textAlign: 'center' }}>{ error }</Text>
            {
              R.isEmpty(identifiers)
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
                <View style={{ marginBottom: 60 }}>

                  { !hasMnemonic ? (
                    <Text style={{ padding: 10, color: 'red' }}>There is no backup available for this ID. We recommend you generate a different identifier and do not keep using this one. (See Help.)</Text>
                  ) : (
                     <Text/>
                  )}

                  { identifiers.map(ident =>
                    <View key={ident.did} style={{ marginTop: 20 }}>

                      <Text>Identifier</Text>
                      <Text style={{ fontSize: 11, marginBottom: 20 }} selectable={true}>
                        { ident.did }
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

                      <QRCode value={qrJwts[ident.did]} size={300}/>

                      <Text style={{ color: 'blue', textAlign: 'right' }} onPress={() => Linking.openURL(qrJwts[ident.did])}>
                        View Online
                      </Text>

                      <Text style={{ color: 'blue', textAlign: 'right' }} onPress={() => copyToClipboard(qrJwts[ident.did])}>
                        Copy to Clipboard
                      </Text>
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

                    </View>
                  )}
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
                  <Button title="Delete Last ID" onPress={deleteLastIdentifier} />
                </View>
              : <View/>
            }
          </View>
          <View>
            <Text style={{ fontSize: 30, fontWeight: 'bold', marginTop: 20 }}>Other</Text>

            <View>
              <Text selectable={true}>Version { pkg.version } ({ VersionNumber.buildVersion })</Text>
            </View>

            <View style={{ marginTop: 20, padding: 10 }}>
              <Text>Home Screen</Text>
              <CheckBox
                title='Bountiful Voluntaryist Community'
                checked={homeIsBVC === 'BVC'}
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
                <CheckBox
                  title='Test Mode'
                  checked={isInTestMode}
                  onPress={() => {setIsInTestMode(!isInTestMode)}}
                />
                {
                isInTestMode
                ? (
                  <View style={{ padding: 10 }}>
                    <Text>Endorser API Server</Text>
                    <TextInput
                      defaultValue={ appStore.getState().apiServer }
                      onChangeText={(text) => {
                        appStore.dispatch(appSlice.actions.setApiServer(text))
                      }}
                      ref={inputApiRef}
                      style={{borderWidth: 1}}
                    />
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

                    <Button
                      title='Use public prod servers'
                      onPress={setToProdServers}
                    />
                    <Button
                      title='Use public test servers'
                      onPress={setToTestServers}
                    />
                    <Button
                      title='Use local test servers'
                      onPress={setToLocalServers}
                    />

                  </View>
                ) : (
                  <View/>
                )}

                <Button
                  title='Log Contact Table'
                  onPress={logDatabaseTable('contact')}
                />
                <Button
                  title='Log Identifier Table'
                  onPress={logDatabaseTable('identifier')}
                />
                <Button
                  title='Log Key Table'
                  onPress={logDatabaseTable('key')}
                />
                <Button
                  title='Log Settings Table'
                  onPress={logDatabaseTable('settings')}
                />

                <Text>Log</Text>
                <Text selectable={true}>{ appStore.getState().logMessage }</Text>
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

export function ExportIdentityScreen({navigation}) {
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

export function ImportIdentityScreen({navigation}) {
  const [error, setError] = useState<string>('')
  const [idChanged, setIdChanged] = useState<boolean>(false)
  const [idImporting, setIdImporting] = useState<boolean>(false)
  const [identifier, setIdentifier] = useState<Omit<IIdentifier, 'provider'>>()
  const [makeLowercase, setMakeLowercase] = useState<boolean>(false)
  const [mnemonic, setMnemonic] = useState<String>('')
  const [mnemonicIsOld, setMnemonicIsOld] = useState<boolean>(false)
  const [mnemonicPassword, setMnemonicPassword] = useState<string>('')

  useEffect(() => {
    const loadOldMnemonic = async () => {
      const conn = await dbConnection
      const settings = await conn.manager.findOne(Settings, MASTER_COLUMN_VALUE)
      if (settings.mnemonic != null) {
        setMnemonic(settings.mnemonic)
        setMnemonicIsOld(true)
      }
    }
    loadOldMnemonic()
  })

  useEffect(() => {
    const coordImportId = async () => {
      appStore.dispatch(appSlice.actions.addLog({log: true, msg: "Importing identifier..."}))
      importAndStoreIdentifier(mnemonic, mnemonicPassword, makeLowercase)
      .then(newIdentifier => {
        appStore.dispatch(appSlice.actions.addLog({log: true, msg: "... totally finished importing identifier."}))
        setIdentifier(newIdentifier)
        setIdChanged(true)

        // one reason redirect automatically is to force reload of ID (which doen't show if they go "back")
        setTimeout(() => {
          // if we goBack or popToTop then the home screen doesn't see the new ID
          navigation.reset({ index: 0, routes: [{ name: "Community Endorser" }] })
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
                      <Text style={{ color: 'red' }}>Seed phrase is not protected, so click below to protect it.</Text>
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
                      title='Convert Address to Lowercase'
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