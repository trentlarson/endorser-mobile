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
import { createAndStoreIdentifier, UPORT_ROOT_DERIVATION_PATH } from '../utility/idUtility'
import { appSlice, appStore, DEFAULT_ENDORSER_API_SERVER, DEFAULT_ENDORSER_VIEW_SERVER, LOCAL_ENDORSER_API_SERVER, LOCAL_ENDORSER_VIEW_SERVER, TEST_ENDORSER_API_SERVER, TEST_ENDORSER_VIEW_SERVER } from "../veramo/appSlice"
import { agent, dbConnection } from "../veramo/setup"
import { styles } from './style'

const logDatabaseTable = (tableName, maxId) => async () => {
  let query = 'SELECT * FROM ' + tableName
  if (maxId) {
    query += ' ORDER BY id DESC LIMIT 1'
  }
  const conn = await dbConnection
  const data = await conn.manager.query(query)
  if (tableName === 'settings') {
    data[0]['mnemEncrBase64'] = 'HIDDEN'
  }
  appStore.dispatch(appSlice.actions.addLog({log: true, msg: "\nContents of table \"" + tableName + "\":\n" + JSON.stringify(data)}))
}

export function SettingsScreen({navigation}) {

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
  const [showMyQr, setShowMyQr] = useState<boolean>(false)
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
    try {
      const qrJwt = await utility.contactJwtForPayload(appStore, identifier)
      setQrJwts(jwts => R.set(R.lensProp(identifier.did), qrJwt, jwts))
    } catch (err) {
      appStore.dispatch(appSlice.actions.addLog({log: true, msg: "Got error setting JWT contents for contact: " + err}))
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
                    <Text style={{ marginTop: 10 }}>
                      The first step to validating contracts is to create your own private keys.
                      Hit "Create Keys" and get started.
                    </Text>
                    { creatingId
                      ? <View>
                        <Text>{createStatus}</Text>
                        <ActivityIndicator size="large" color="#00ff00" />
                      </View>
                      : <View>
                        <Button title="Create Keys" onPress={() => { setCreatingId(true) }} />
                        <Text>Advanced</Text>
                        <Text>You may guard your seed phrase with a password, but this is optional.</Text>
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

                          <Text style={{ marginBottom: 10, ...styles.centeredText }}>
                            Share Your Public Info URL:
                          </Text>

                          <Text style={{ color: 'blue', ...styles.centeredText }} onPress={() => Linking.openURL(qrJwts[ident.did])}>
                            View Online
                          </Text>

                          <Text style={{ color: 'blue', ...styles.centeredText }} onPress={() => copyToClipboard(qrJwts[ident.did])}>
                            Copy to Clipboard
                          </Text>

                          <Text
                            style={{ color: 'blue', ...styles.centeredText }}
                            onPress={() => setShowMyQr(!showMyQr)}
                          >
                            { (showMyQr ? "Hide" : "Show") + " QR Code" }
                          </Text>
                          {
                            showMyQr
                            ?
                              <View style={{ marginBottom: 10, ...styles.centeredView}}>
                                <QRCode value={qrJwts[ident.did]} size={300}/>
                              </View>
                            :
                              <View/>
                          }

                          <View style={{ padding: 10 }} />

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

            <View style={{ marginTop: 10 }}/>
            <View>
              <Text selectable={true}>Version { pkg.version } ({ VersionNumber.buildVersion })</Text>
            </View>

            <View style={{ marginTop: 10 }}/>
            <Text
              style={{ color: 'blue' }}
              onPress={() => navigation.navigate(utility.HELP_SCREEN_NAV)}
            >
              Help
            </Text>

            <View style={{ marginTop: 10 }}/>
            <Text
              style={{ color: 'blue' }}
              onPress={() => navigation.navigate('Notification Permissions')}
            >
              Check Permissions
            </Text>

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
                  title='Log All Private Data'
                  onPress={logDatabaseTable('privateData')}
                />
                <View style={{ marginTop: 5 }}/>
                <Button
                  title='Log Latest Private Datum'
                  onPress={logDatabaseTable('privateData', true)}
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
