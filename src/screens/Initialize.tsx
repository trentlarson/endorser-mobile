import * as R from 'ramda'
import React, { useEffect, useState } from "react"
import { ActivityIndicator, Button, SafeAreaView, ScrollView, Text, TextInput, View } from "react-native"
import { classToPlain } from "class-transformer"
import { useSelector } from 'react-redux'

import { MASTER_COLUMN_VALUE, Settings } from "../entity/settings"
import { createAndStoreIdentifier } from '../utility/idUtility'
import { appSlice, appStore } from "../veramo/appSlice"
import { agent, dbConnection } from "../veramo/setup"

export function InitializeScreen({navigation}) {

  const [creatingId, setCreatingId] = useState<boolean>(false)
  const [error, setError] = useState<string>('')
  const [hasMnemonic, setHasMnemonic] = useState<boolean>(false)
  const [mnemonicPassword, setMnemonicPassword] = useState<string>('')

  const identifiersSelector = useSelector((state) => state.identifiers || [])

  const setNewId = async (ident) => {
    const pojoIdent = classToPlain(ident)
    appStore.dispatch(appSlice.actions.addIdentifier(pojoIdent))

    const conn = await dbConnection
    let settings = await conn.manager.findOne(Settings, MASTER_COLUMN_VALUE)
    if (settings && (settings.mnemEncrBase64 || settings.mnemonic)) {
      setHasMnemonic(true)
    }
  }

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
      // wait a bit to let the UI update to show the spinner
      setTimeout(() => createIdentifier(), 100)
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
                <View>
                  <Text style={{ marginTop: 10 }}>
                    The first step to validating contracts is to create your own private keys.
                    Hit "Create Keys" and get started.
                  </Text>
                  { creatingId
                    ? <View>
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

                      <View style={{ marginTop: 10 }} />
                      <Text>
                        For reference, here is your ID. But you don't have to remember it...
                        we will maintain it for you, and you can find it again any time.
                      </Text>

                      <Text style={{ fontSize: 11, marginBottom: 20, marginTop: 20 }} selectable={true}>
                        { ident.did }
                      </Text>

                    </View>
                  )
                  }

                  <View style={{ marginTop: 20, marginBottom: 20 }}>
                    <Text>We recommend you backup your keys now. You can also do this anytime in the future.</Text>
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
