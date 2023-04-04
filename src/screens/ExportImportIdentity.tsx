import React, { useEffect, useState } from "react"
import { ActivityIndicator, Button, SafeAreaView, ScrollView, Text, TextInput, View } from "react-native"
import Clipboard from "@react-native-community/clipboard"
import { CheckBox } from "react-native-elements"
import { useSelector } from 'react-redux'

import { MASTER_COLUMN_VALUE, Settings } from "../entity/settings"
import * as utility from "../utility/utility"
import { importAndStoreIdentifier } from "../utility/idUtility"
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
  const [makeLowercase, setMakeLowercase] = useState<boolean>(false)
  const [mnemonic, setMnemonic] = useState<String>('')
  //const [mnemonic, setMnemonic] = useState<String>('seminar accuse mystery assist delay law thing deal image undo guard initial shallow wrestle list fragile borrow velvet tomorrow awake explain test offer control')
  //const [mnemonic, setMnemonic] = useState<String>('annual soap surround inhale island jewel blush rookie gate aerobic brave enlist bird nut remain cross undo surround year rapid blade impulse control broccoli')
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
                        <Text>Note that this will also create an identifier with the default uPort derivation path.</Text>
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
