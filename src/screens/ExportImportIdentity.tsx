import React, { useEffect, useState } from "react"
import { ActivityIndicator, Button, SafeAreaView, ScrollView, Text, TextInput, View } from "react-native"
import Clipboard from "@react-native-community/clipboard"
import { CheckBox } from "react-native-elements"
import { useSelector } from 'react-redux'

import { MASTER_COLUMN_VALUE, Settings } from "../entity/settings"
import * as utility from "../utility/utility"
import {
  DEFAULT_ROOT_DERIVATION_PATH,
  importAndStoreIdentifier,
  UPORT_ROOT_DERIVATION_PATH
} from "../utility/idUtility";
import { appSlice, appStore } from "../veramo/appSlice"
import { dbConnection, HANDY_APP } from "../veramo/setup"

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
                <Text>... and, for recovery anywhere, be sure to record your derivation path from the Settings page.</Text>
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
  const [derivationPath, setDerivationPath] = useState<string>(DEFAULT_ROOT_DERIVATION_PATH)
  const [error, setError] = useState<string>('')
  const [idChanged, setIdChanged] = useState<boolean>(false)
  const [idImporting, setIdImporting] = useState<boolean>(false)
  const [makeLowercase, setMakeLowercase] = useState<boolean>(false)
  const [mnemonic, setMnemonic] = useState<String>('')
  //const [mnemonic, setMnemonic] = useState<String>('rigid shrug mobile smart veteran half all pond toilet brave review universe ship congress found yard skate elite apology jar uniform subway slender luggage') // user 000
  //const [mnemonic, setMnemonic] = useState<String>('wild trade rescue help access cave expand toward coconut gas weird neck history wealth desk course action number print ahead black song dumb long') // user 222
  const [mnemonicIsOld, setMnemonicIsOld] = useState<boolean>(false)
  const [mnemonicPassword, setMnemonicPassword] = useState<string>('')
  const [showDerivationPath, setShowDerivationPath] = useState<boolean>(false)

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

      importAndStoreIdentifier(mnemonic, mnemonicPassword, derivationPath, makeLowercase, identifiersSelector)
      .then(newIdentifier => {
        appStore.dispatch(appSlice.actions.addLog({log: true, msg: "... totally finished importing identifier."}))
        setIdChanged(true)

        // one reason redirect automatically is to force reload of ID (which doen't show if they go "back")
        setTimeout(() => {
          // if we goBack or popToTop then the home screen doesn't see the new ID
          navigation.reset({ index: 0, routes: [{ name: "Settings" }] })
          navigation.navigate(utility.CLAIMS_HOME_SCREEN_NAV)
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
      // wait a bit so that the UI can update to show the spinner
      setTimeout(() => coordImportId(), 100)
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
                    {
                    HANDY_APP
                    ?
                      <View/>
                    :
                      <View>
                        <CheckBox
                          title='Convert Address to Lowercase -- Check this if you used the original uPort app.'
                          checked={makeLowercase}
                          onPress={() => setMakeLowercase(!makeLowercase)}
                        />
                        {
                          showDerivationPath
                          ?
                            <View>
                              <Text>Derivation Path</Text>
                              <TextInput
                                value={derivationPath}
                                onChangeText={setDerivationPath}
                                autoCapitalize={'none'}
                                style={{borderWidth: 1}}
                              />
                              <Text
                                style={{ color: 'blue', padding: 10 }}
                                onPress={() => setDerivationPath(DEFAULT_ROOT_DERIVATION_PATH)}
                              >
                                Set to default (matching Time Safari)
                              </Text>
                              <Text
                                style={{ color: 'blue', padding: 10 }}
                                onPress={() => setDerivationPath(UPORT_ROOT_DERIVATION_PATH)}
                              >
                                Set to legacy version (matching uPort)
                              </Text>
                            </View>
                          :
                            <Text
                              style={{ color: 'blue', padding: 10 }}
                              onPress={() => setShowDerivationPath((prev) => !prev)}
                            >
                              Show Derivation Path
                            </Text>
                        }
                      </View>
                    }
                    <Button
                      title={'Import From Seed Phrase'}
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
