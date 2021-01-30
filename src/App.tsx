import 'react-native-gesture-handler'

import * as bip32 from 'bip32'
import * as bip39 from 'bip39'
const EC = require('elliptic').ec
import * as didJwt from 'did-jwt'
import { HDNode } from '@ethersproject/hdnode'
import React, { useEffect, useState } from 'react'
import { SafeAreaView, ScrollView, View, Text, TextInput, Button } from 'react-native'
import QRCode from 'react-native-qrcode-svg'
import { NavigationContainer } from '@react-navigation/native'
import { createStackNavigator } from '@react-navigation/stack'

import { agent } from './veramo/setup'
import { CredentialsScreen } from './screens/SignSendToEndorser'
import { ContactsScreen, ContactImportScreen } from './screens/Contacts'

const DEFAULT_DID_PROVIDER = 'did:ethr'
const secp256k1 = new EC('secp256k1')

interface Identifier {
  did: string
}

function HomeScreen({ navigation }) {
  return (
    <View>
      <Button
        title="Credentials"
        onPress={() => navigation.navigate('Credentials')}
      />
      <Button
        title="Contacts"
        onPress={() => navigation.navigate('Contacts')}
      />
      <Button
        title="Settings"
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
      await agent.didManagerDelete(identifiers[identifiers.length - 1])
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
          <Text style={{ fontSize: 30, fontWeight: 'bold' }}>Identifier</Text>
          <View style={{ marginBottom: 50, marginTop: 20 }}>
            {identifiers && identifiers.length > 0 ? (
              identifiers.map((id: Identifier) => {
                const publicEncKey = Buffer.from(id.keys[0].publicKeyHex, 'hex').toString('base64')           
                // this is uPort's QR code format
                const shareId = {
                  iss: id.did,
                  own: {
                    publicEncKey,
                  },
                }
                return <View key={id.did} style={{ padding: 20 }}>
                  <Text style={{ fontSize: 11, marginBottom: 20 }}>{id.did}</Text>
                  <Text style={{ marginBottom: 5 }}>Your info for sharing:</Text>
                  <QRCode value={JSON.stringify(shareId)} size={310} />
                </View>
              })
            ) : (
              <View style={{ alignItems: 'baseline', marginTop: 10 }}>
                <Text>There are no identifiers.</Text>
                <Button title={'Create Identifier'} onPress={() => createIdentifier()} />
              </View>
            )}
          </View>
          <View style={{ alignItems: 'baseline', marginBottom: 50, marginTop: 10 }}>
            { (!identifiers || identifiers.length == 0) &&
              <Button
                title="Import Identifier"
                onPress={() => navigation.navigate('Import Identifier')}
              />
            }
            { identifiers && identifiers.length > 0 &&
              <Button
                title="Export Identifier"
                onPress={() => navigation.navigate('Export Identifier')}
              />
            }
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

    /**
    // approach from https://github.com/uport-project/veramo/discussions/346#discussioncomment-302234
    // ... doesn't work because hdNode.mnemonic is undefined
    console.log("identifier.keys[0].privateKeyHex", identifier.keys[0].privateKeyHex)
    const privBytes = Buffer.from(identifier.keys[0].privateKeyHex, 'hex')
    const hdNode = HDNode.fromSeed(privBytes)
    console.log('hdNode',hdNode)
    const mnemonic = hdNode.mnemonic
    console.log('mnemonic',mnemonic)
    //const hdnode: HDNode = HDNode.fromMnemonic(mnemonic)
    **/

    // approach from bip39
    const mnemonic = bip39.entropyToMnemonic(identifier.keys[0].privateKeyHex)

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
            <Button title={'Click to export identifier mnemonic'} onPress={() => exportIdentifier()} />
            {mnemonic ? (
              <TextInput
                multiline={true}
                style={{ borderWidth: 1, height: 80 }}
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

    // if you remove this, yarn remove bip39 bip32 ... and maybe EC stuff
    /**
    // approach I pieced together
    const keyHex: string = bip39.mnemonicToEntropy(mnemonic)
    // returns a KeyPair from the elliptic.ec library
    const keyPair = secp256k1.keyFromPrivate(keyHex, 'hex')
    // this code is from did-provider-eth createIdentifier
    const privateHex = keyPair.getPrivate('hex')
    const publicHex = keyPair.getPublic('hex')
    const address = didJwt.toEthereumAddress(publicHex)
    **/

    // from https://github.com/uport-project/veramo/discussions/346#discussioncomment-302234
    const UPORT_ROOT_DERIVATION_PATH = "m/7696500'/0'/0'/0'"

    // if you remove this, yarn remove bip32 (& bip39 if not used in export)
    /**
    // approach from bip32 & bip39
    const seed = bip39.mnemonicToSeedSync(mnemonic)
    const root = bip32.fromSeed(seed)
    const node = root.derivePath(UPORT_ROOT_DERIVATION_PATH)
    const privateHex = node.privateKey.toString("hex")
    const publicHex = node.publicKey.toString('hex')
    const address = didJwt.toEthereumAddress(publicHex)
    console.log('Address from didJwt.toEthereumAddress:', address)
    **/

    // if you remove this, yarn remove @ethersproject/hdnode
    // approach from https://github.com/uport-project/veramo/discussions/346#discussioncomment-302234
    const hdnode: HDNode = HDNode.fromMnemonic(mnemonic)
    const rootNode: HDNode = hdnode.derivePath(UPORT_ROOT_DERIVATION_PATH)

    console.log('node', rootNode)
    const privateHex = rootNode.privateKey.substring(2)
    const publicHex = rootNode.privateKey.substring(2)
    const address = rootNode.address

    const newIdentifier: Omit<IIdentifier, 'provider'> = {
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
    agent.didManagerImport(newIdentifier)
    setIdentifier(newIdentifier)
    setIdChanged(true)

    // one reason redirect automatically is to force reload of ID (which doen't show if they go "back")
    setTimeout(() => navigation.popToTop(), 500)
  }

  return (
    <SafeAreaView>
      <ScrollView>
        <View style={{ padding: 20 }}>
          <Text style={{ fontSize: 30, fontWeight: 'bold' }}>Mnemonic</Text>
          <View style={{ marginBottom: 50, marginTop: 20 }}>
            {idChanged ? (
              <Text style={{ fontSize: 30 }}>Success!</Text>
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
                    title={'Click to import from mnemonic'}
                    onPress={importIdentifier}
                  />
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
        <Stack.Screen name="Community Endorser" component={HomeScreen} />
        <Stack.Screen name="ContactImport" component={ContactImportScreen} />
        <Stack.Screen name="Contacts" component={ContactsScreen} />
        <Stack.Screen name="Credentials" component={CredentialsScreen} />
        <Stack.Screen name="Export Identifier" component={ExportIdentityScreen} />
        <Stack.Screen name="Import Identifier" component={ImportIdentityScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  )
}

export default App
