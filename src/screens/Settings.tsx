import * as R from 'ramda'
import React, { useCallback, useEffect, useRef, useState } from "react"
import { ActivityIndicator, Alert, Button, DevSettings, Linking, Modal, SafeAreaView, ScrollView, Text, TextInput, TouchableHighlight, View } from "react-native"
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
import {
  createAndStoreIdentifier,
  DEFAULT_ROOT_DERIVATION_PATH
} from "../utility/idUtility";
import { appSlice, appStore, DEFAULT_ENDORSER_API_SERVER, DEFAULT_ENDORSER_VIEW_SERVER, LOCAL_ENDORSER_API_SERVER, LOCAL_ENDORSER_VIEW_SERVER, TEST_ENDORSER_API_SERVER, TEST_ENDORSER_VIEW_SERVER } from "../veramo/appSlice"
import { agent, dbConnection } from "../veramo/setup"
import { styles } from './style'
import Icon from "react-native-vector-icons/FontAwesome";

interface RateLimits {
  doneClaimsThisWeek: string;
  doneRegistrationsThisMonth: string;
  maxClaimsPerWeek: string;
  maxRegistrationsPerMonth: string;
  nextMonthBeginDateTime: string;
  nextWeekBeginDateTime: string;
}

export function SettingsScreen({navigation}) {

  const [confirmDeleteLastIdentifier, setConfirmDeleteLastIdentifier] = useState<boolean>(false)
  const [createStatus, setCreateStatus] = useState<string>('')
  const [creatingId, setCreatingId] = useState<boolean>(false)
  const [error, setError] = useState<string>('')
  const [finishedCheckingIds, setFinishedCheckingIds] = useState<boolean>(false)
  const [homeProjectId, setHomeProjectId] = useState<string>(appStore.getState().homeProjectId)
  // we'll ensure this is always some array, even if the DB has a null value
  const [homeScreenValues, setHomeScreenValues] = useState<string[]>([])
  const [hasMnemonic, setHasMnemonic] = useState<boolean>(false)
  const [isInAdvancedMode, setIsInAdvancedMode] = useState<boolean>(appStore.getState().advancedMode)
  const [isInTestMode, setIsInTestMode] = useState<boolean>(appStore.getState().testMode)
  const [inputApiServer, setInputApiServer] = useState<string>(appStore.getState().settings.apiServer)
  const [inputName, setInputName] = useState<string>('')
  const [lastNotifiedClaimId, setLastNotifiedClaimId] = useState<string>(appStore.getState().settings.lastNotifiedClaimId)
  const [lastViewedClaimId, setLastViewedClaimId] = useState<string>(appStore.getState().settings.lastViewedClaimId)
  const [limits, setLimits] = useState<RateLimits>(null)
  const [limitsMessage, setLimitsMessage] = useState<string>('')
  const [mnemonicPassword, setMnemonicPassword] = useState<string>('')
  const [qrJwts, setQrJwts] = useState<Record<string,string>>({})
  const [quickMessage, setQuickMessage] = useState<string>(null)
  const [showMyQr, setShowMyQr] = useState<boolean>(false)
  const [showPrivateKey, setShowPrivateKey] = useState<boolean>(false)
  const [storedApiServer, setStoredApiServer] = useState<string>(appStore.getState().settings.apiServer)
  const [storedName, setStoredName] = useState<string>('')

  const identifiersSelector = useSelector((state) => state.identifiers || [])
  const homeScreenSelector = useSelector((state) => (state.settings || {}).homeScreen)

  const toggleStateForHomeIsBVC = async () => {
    const newValue = homeScreenSelector == null ? 'BVC' : null
    const conn = await dbConnection
    await conn.manager.save(Settings, { id: MASTER_COLUMN_VALUE, homeScreen: newValue })
    appStore.dispatch(appSlice.actions.setHomeScreen(newValue))
  }
  const toggleHomeShowsBVC = () => {

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
    await conn.manager.update(Settings, MASTER_COLUMN_VALUE, { apiServer: valueToSave })
    const settings = classToPlain(appStore.getState().settings)
    settings.apiServer = valueToSave
    appStore.dispatch(appSlice.actions.setSettings(settings))
    setInputApiServer(valueToSave)
    setStoredApiServer(valueToSave)
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

    const settings = classToPlain(appStore.getState().settings)
    settings.name = inputName
    await appStore.dispatch(appSlice.actions.setSettings(settings))

    // The JWT QR depends on the name being stored in the settings.
    identifiersSelector.forEach(ident => {
      setQrJwtForPayload(ident, inputName)
    })

    setStoredName(inputName)
  }

  const setQrJwtForPayload = async (identifier, name) => {
    try {
      const qrJwt = await utility.contactJwtForPayload(identifier, name)
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

  const storeHomeProjectId = async (value) => {
    appStore.dispatch(appSlice.actions.setHomeProjectId(value))
    setHomeProjectId(value)
  }

  // Store the new home screen values in the DB and global & page state.
  const storeHomeScreenValues = async (values) => {
    // save in DB
    const conn = await dbConnection
    await conn.manager.update(Settings, MASTER_COLUMN_VALUE, { homeScreen: JSON.stringify(values) })

    // save in global state
    const settings = classToPlain(appStore.getState().settings)
    settings.homeScreen = JSON.stringify(values)
    appStore.dispatch(appSlice.actions.setSettings(settings))

    // save in page state
    setHomeScreenValues(values)
  }

  const addHomeScreenValue = async (value) => {
    const newValues = [...homeScreenValues, value]
    await storeHomeScreenValues(newValues)
  }

  const removeHomeScreenValue = async (value) => {
    const newValues = homeScreenValues.filter(v => v !== value)
    await storeHomeScreenValues(newValues)
  }

  const toggleHomeScreenValue = async (value) => {
    if (homeScreenValues.indexOf(value) > -1) {
      await removeHomeScreenValue(value)
    } else {
      await addHomeScreenValue(value)
    }
  }

  const checkLimits = async () => {
    const endorserApiServer = appStore.getState().settings.apiServer
    const token = await utility.accessToken(identifiersSelector[0])
    fetch(endorserApiServer + '/api/report/rateLimits', {
      headers: {
        "Content-Type": "application/json",
        "Uport-Push-Token": token,
      }
    }).then(async response => {
      if (response.status === 200) {
        const result = await response.json()
        setLimits(result)
        setLimitsMessage('')
      } else {
        setLimitsMessage('Could not retrieve your limits. You may not be registered, in which case you need to ask an existing user to help you. See logs (near the bottom of Help) for details.')
        const text = await response.text()
        appStore.dispatch(appSlice.actions.addLog({log: true, msg: "Got bad result retrieving limits. " + text}))
      }
    }).catch(e => {
      setLimitsMessage('There was an error retrieving your limits. See logs for details.')
      appStore.dispatch(appSlice.actions.addLog({log: true, msg: "Got error retrieving limits. " + e}))
    })
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
  }, [appStore.getState().identifiers])

  useEffect(() => {
    const setHomeScreen = async () => {
      try {
        setHomeScreenValues(JSON.parse(appStore.getState().settings.homeScreen) || [])
      } catch (e) {
        appStore.dispatch(appSlice.actions.addLog({
          log: true,
          msg: "Unable to work with home screen setting of "
            + appStore.getState().settings.homeScreen
            + " because: " + e + " -- it'll stay []"
        }))
      }
    }
    setHomeScreen()
  }, [])

  useEffect(() => {
    const createIdentifier = async () => {
      appStore.dispatch(appSlice.actions.addLog({log: true, msg: "Creating new identifier..."}))
      createAndStoreIdentifier(mnemonicPassword, DEFAULT_ROOT_DERIVATION_PATH)
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
      // wait a bit to let the UI update to show the spinner
      setTimeout(() => createIdentifier(), 100)
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
                      Hit "Create New Keys" and get started.
                    </Text>
                    { creatingId
                      ? <View>
                        <Text>{createStatus}</Text>
                        <ActivityIndicator size="large" color="#00ff00" />
                      </View>
                      : <View>
                        <Button title="Create New Keys" onPress={()=>navigation.navigate('Initialize')} />
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
                        &nbsp;&nbsp;
                        <Icon
                          onPress={() => copyToClipboard(ident.did)}
                          name="copy"
                          style={{ color: 'blue' }}
                        />
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

                          <Text>
                            Share Your Public Info URL:
                          </Text>

                          <View style={{ padding: 10 }} />
                          <Text style={{ color: 'blue', ...styles.centeredText }} onPress={() => copyToClipboard(qrJwts[ident.did])}>
                            Copy to Clipboard
                          </Text>

                          <View style={{ padding: 10 }} />
                          <Text style={{ color: 'blue', ...styles.centeredText }} onPress={() => Linking.openURL(qrJwts[ident.did])}>
                            View Online
                          </Text>

                          <View style={{ padding: 10 }} />
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
                          <Text style={{ marginBottom: 20 }}>
                            { Buffer.from(ident.keys[0].publicKeyHex, 'hex').toString('base64') }
                            &nbsp;&nbsp;
                            <Icon
                              onPress={() => copyToClipboard(Buffer.from(ident.keys[0].publicKeyHex, 'hex').toString('base64'))}
                              name="copy"
                              style={{ color: 'blue' }}
                            />
                          </Text>

                          <Text>Public Key (hex)</Text>
                          <Text style={{ marginBottom: 20 }}>
                            { ident.keys[0].publicKeyHex }
                            &nbsp;&nbsp;
                            <Icon
                              onPress={() => copyToClipboard(ident.keys[0].publicKeyHex)}
                              name="copy"
                              style={{ color: 'blue' }}
                            />
                          </Text>

                          <Text>Derivation Path</Text>
                          <Text style={{ marginBottom: 20 }}>
                            { ident.keys[0].meta && ident.keys[0].meta.derivationPath ? ident.keys[0].meta.derivationPath : 'Unknown. Probably: ' + DEFAULT_ROOT_DERIVATION_PATH }
                            &nbsp;&nbsp;
                            <Icon
                              onPress={() => copyToClipboard(ident.keys[0].meta && ident.keys[0].meta.derivationPath ? ident.keys[0].meta.derivationPath : 'Unknown. Probably: ' + DEFAULT_ROOT_DERIVATION_PATH)}
                              name="copy"
                              style={{ color: 'blue' }}
                            />
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
                  <Button title="Create New Keys Directly" onPress={()=>{setCreatingId(true)}} />
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
              See Help
            </Text>

            <View style={{ marginTop: 10 }} />
            <Text
              style={{ color: 'blue' }}
              onPress={() => navigation.navigate('Notification Permissions')}
            >
                Check Notification Permissions
            </Text>

            {
              identifiersSelector.length == 0
              ?
                <View/>
              :
                <View>
                  <Text
                    style={{ color: 'blue', marginTop: 10 }}
                    onPress={checkLimits}
                  >
                    Check Registration and Claim Limits
                  </Text>
                  {
                    limits == null
                    ?
                      <View/>
                    :
                      <View style={{ padding: 10 }}>
                        <Text style>
                          You have done {limits.doneClaimsThisWeek} {limits.doneClaimsThisWeek === 1 ? "claim" : "claims"} out of {limits.maxClaimsPerWeek} for this week. Your claims counter resets at: {R.replace('T', ' ', limits.nextWeekBeginDateTime)}
                        </Text>
                        <Text>
                          You have done {limits.doneRegistrationsThisMonth} {limits.doneRegistrationsThisMonth === 1 ? "registration" : "registrations"} out of {limits.maxRegistrationsPerMonth} for this month. Your registrations counter resets at: {R.replace('T', ' ', limits.nextMonthBeginDateTime)}
                        </Text>
                        <Text>
                          Note that you cannot register anyone the day you get registered, and you can only register one per day during your first month.
                        </Text>
                      </View>
                  }
                  <Text style={{ padding: 10 }}>{limitsMessage}</Text>
                </View>
            }

            <CheckBox
              title='Advanced Mode'
              checked={isInAdvancedMode}
              onPress={toggleAdvancedMode}
            />

            {
            isInAdvancedMode
            ? (
              <View>

                <Text
                  style={{ color: 'blue' }}
                  onPress={() => navigation.navigate('Logs')}
                >
                  See Logs
                </Text>

                <View style={{ marginTop: 10 }}/>
                <Text>Endorser API Server</Text>
                <TextInput
                  value={inputApiServer || ''}
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

                <View style={{ marginTop: 10, padding: 10 }}>
                  <Text>Home Screen</Text>
                  <CheckBox
                    title='Gave'
                    checked={homeScreenValues.indexOf('Gave') !== -1}
                    onPress={() => toggleHomeScreenValue('Gave')}
                  />
                  <CheckBox
                    title='Bountiful Voluntaryist Community'
                    checked={homeScreenValues.indexOf('BVC') !== -1}
                    onPress={() => toggleHomeScreenValue('BVC')}
                  />
                </View>

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

                    <Text>Home Project</Text>
                    <TextInput
                      value={homeProjectId || ''}
                      onChangeText={storeHomeProjectId}
                      style={{borderWidth: 1}}
                    />

                    <View style={{ marginTop: 5 }}/>
                    <Button title="Reload App" onPress={() => DevSettings.reload()} />

                  </View>
                ) : (
                  <View/>
                )}

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
