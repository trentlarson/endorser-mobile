import 'react-native-gesture-handler'

import { entropyToMnemonic, mnemonicToEntropy } from 'bip39'
const EC = require('elliptic').ec
import { toEthereumAddress } from 'did-jwt'
import React, { useEffect, useState } from 'react'
import { SafeAreaView, ScrollView, View, Text, TextInput, Button } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { createStackNavigator } from '@react-navigation/stack'

// Import agent from setup
import { agent, DID_PROVIDER } from './veramo/setup'

const secp256k1 = new EC('secp256k1')

interface Identifier {
  did: string
}

function HomeScreen({ navigation }) {
  return (
    <View>
      <Button
        title="Go to Settings"
        onPress={() => navigation.navigate('Settings')}
      />
    </View>
  );
}

function SettingsScreen({ navigation }) {
  const [identifiers, setIdentifiers] = useState<Identifier[]>([])

  // Add the new identifier to state
  const createIdentifier = async () => {
    const _id = await agent.didManagerCreate()
    setIdentifiers((s) => s.concat([_id]))
  }

  const deleteIdentifier = async () => {
    if (identifiers.length > 0) {
      await agent.didManagerDelete(identifiers[0])
      const _ids = await agent.didManagerFind()
      setIdentifiers(_ids)
    }
  }

  // Check for existing identifers on load and set them to state
  useEffect(() => {
    const getIdentifiers = async () => {
      const _ids = await agent.didManagerFind()
      setIdentifiers(_ids)

      // Inspect the id object in your debug tool
      console.log('_ids:', JSON.stringify(_ids))
    }
    getIdentifiers()
  }, [])

  return (
    <SafeAreaView>
      <ScrollView>
        <View style={{ padding: 20 }}>
          <Text style={{ fontSize: 30, fontWeight: 'bold' }}>Identifiers</Text>
          <View style={{ marginBottom: 50, marginTop: 20 }}>
            {identifiers && identifiers.length > 0 ? (
              identifiers.map((id: Identifier) => (
                <View key={id.did}>
                  <Text>{id.did}</Text>
                </View>
              ))
            ) : (
              <View>
                <Text>There are no identifiers.</Text>
                <Button title={'Create Identifier'} onPress={() => createIdentifier()}  />
              </View>
            )}
          </View>
          <View style={{ alignItems: 'baseline', marginBottom: 50, marginTop: 100 }}>
            <Button
              title="Import Identifier"
              onPress={() => navigation.navigate('Import Identifier')}
            />
            <Button
              title="Export Identifier"
              onPress={() => navigation.navigate('Export Identifier')}
            />
            {/** good for tests, bad for users
            <Button title="Delete ID" onPress={() => deleteIdentifier()} />
            <Button title={'Create ID'} onPress={() => createIdentifier()} />
            **/}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function ExportIdentityScreen({ navigation }) {
  const [identifier, setIdentifier] = useState<Identifier>()
  const [mnemonic, setMnemonic] = useState<String>('')

  const exportIdentifier = async () => {
    let mnemonic = entropyToMnemonic(identifier.keys[0].privateKeyHex)
    setMnemonic(mnemonic)
  }

  // Check for existing identifers on load and set them to state
  useEffect(() => {
    const getIdentifiers = async () => {
      const _ids = await agent.didManagerFind()
      setIdentifier(_ids[0])
    }
    getIdentifiers()
  }, [])

  return (
    <View style={{ padding: 20 }}>
      <View style={{ marginBottom: 50, marginTop: 20 }}>
        {identifier ? (
          <View>
            <Button title={'Click to export identifier mnemonic seed'} onPress={() => exportIdentifier()} />
            {mnemonic ? (
              <TextInput
                multiline={true}
                style={{ borderWidth: 1, height: 80 }}
                onChangeText={setMnemonic}
                editable={false}
              >
              { mnemonic }
              </TextInput>
            ) : (
              <View/>
            )}
          </View>
        ) : (
          <View> 
            <Text>There are no identifiers to export.</Text>
          </View>
        )}
      </View>
    </View>
  )
}

function ImportIdentityScreen({ navigation }) {
  const [identifier, setIdentifier] = useState<Identifier>()
  const [mnemonic, setMnemonic] = useState<String>('')
  const [idChanged, setIdChanged] = useState<boolean>(false)

  // Check for existing identifers on load and set them to state
  useEffect(() => {
    const getIdentifiers = async () => {
      const _ids = await agent.didManagerFind()
      setIdentifier(_ids[0])
    }
    getIdentifiers()
  }, [])

  const importIdentifier = async () => {

    const keyHex: string = mnemonicToEntropy(mnemonic)

    // returns a KeyPair from the elliptic.ec library
    const keyPair = secp256k1.keyFromPrivate(keyHex, 'hex')
    // this code is from did-provider-eth createIdentifier
    const publicHex = keyPair.getPublic('hex')
    const privateHex = keyPair.getPrivate('hex')
    const address = toEthereumAddress(publicHex)
    const newIdentifier: Omit<IIdentifier, 'provider'> = {
      did: DID_PROVIDER + ':' + address,
      keys: [{
        kid: publicHex,
        kms: 'local',
        type: 'Secp256k1',
        publicKeyHex: publicHex,
        privateKeyHex: privateHex
      }],
      provider: DID_PROVIDER,
      services: []
    }
    agent.didManagerImport(newIdentifier)
    setIdentifier(newIdentifier)
    setIdChanged(true)
    // one reason redirect automatically is to force reload of ID (which doen't show if they go "back")
    setTimeout(() => navigation.popToTop(), 1000)
  }

  return (
    <SafeAreaView>
      <ScrollView>
        <View style={{ padding: 20 }}>
          <Text style={{ fontSize: 30, fontWeight: 'bold' }}>Mnemonic Seed</Text>
          <View style={{ marginBottom: 50, marginTop: 20 }}>
            {idChanged ? (
              <Text>Success!</Text>
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
                    style={{ borderWidth: 1, height: 100 }}
                    onChangeText={setMnemonic}
                  >
                  </TextInput>
                  <Button
                    title={'Click to import from mnemonic seed'}
                    onPress={importIdentifier} />
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

const Stack = createStackNavigator();

const App = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="Export Identifier" component={ExportIdentityScreen} />
        <Stack.Screen name="Import Identifier" component={ImportIdentityScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  )
}

export default App
