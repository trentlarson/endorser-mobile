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

export function InitializeScreen({navigation}) {

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
  const [showPrivateKey, setShowPrivateKey] = useState<boolean>(false)
  const [storedApiServer, setStoredApiServer] = useState<string>(appStore.getState().settings.apiServer)
  const [storedName, setStoredName] = useState<string>('')

  const identifiersSelector = useSelector((state) => state.identifiers || [])
  const homeScreenSelector = useSelector((state) => (state.settings || {}).homeScreen)

  const setNewId = async (ident) => {
    const pojoIdent = classToPlain(ident)
    appStore.dispatch(appSlice.actions.addIdentifier(pojoIdent))

    const conn = await dbConnection
    let settings = await conn.manager.findOne(Settings, MASTER_COLUMN_VALUE)
    if (settings && (settings.mnemEncrBase64 || settings.mnemonic)) {
      setHasMnemonic(true)
    }
  }

  // Check for existing identifers on load and set them to state
  useEffect(() => {
    const getIdentifiers = async () => {
      const conn = await dbConnection
      let settings = await conn.manager.findOne(Settings, MASTER_COLUMN_VALUE)
      if (settings && (settings.mnemEncrBase64 || settings.mnemonic)) {
        setHasMnemonic(true)
      }
      setFinishedCheckingIds(true)
    }
    getIdentifiers()
  }, []) // Why does this loop infinitely with any variable, even with classToPlain(identifiers) that doesn't change?

  useEffect(() => {
    const createIdentifier = async () => {
      appStore.dispatch(appSlice.actions.addLog({
        log: true,
        msg: "Creating new identifier..."
      }))
      createAndStoreIdentifier(mnemonicPassword)
      .then(setNewId)
      .then(() => {
        setCreatingId(false)
        setError("")
        appStore.dispatch(appSlice.actions.addLog({
          log: true,
          msg: "... totally finished creating identifier."
        }))
      })
      .catch(err => {
        appStore.dispatch(appSlice.actions.addLog({
          log: true,
          msg: "... got error creating identifier: " + err
        }))
        setError("There was an error. " + err)
      })
    }
    if (creatingId) {
      createIdentifier()
    }
  }, [creatingId])

  return (
    <SafeAreaView>
      <ScrollView>
        <View style={{padding: 20}}>
          <Text style={{fontSize: 30, fontWeight: 'bold'}}>New Keys</Text>
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

                      <Text>You now have your own keys!</Text>

                      <Text>
                        Here it is for reference, but you don't have to remember it...
                        we will maintain it for you, and you can find it again any time.
                      </Text>

                      <Text style={{ fontSize: 11, marginBottom: 20, marginTop: 20 }} selectable={true}>
                        { ident.did }
                      </Text>

                    </View>
                  )
                  }

                  <View style={{ marginTop: 20, marginBottom: 20 }}>
                    <Text>You may backup your keys now if you like. You can also do this anytime in the future.</Text>
                    <Button
                      title="Export Seed Phrase"
                      onPress={() => navigation.navigate('Export Seed Phrase')}
                    />
                  </View>
                </View>
            }
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
