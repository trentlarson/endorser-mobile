import 'react-native-gesture-handler'
import 'reflect-metadata'

import * as bip32 from 'bip32'
import * as bip39 from 'bip39'
import { classToPlain } from 'class-transformer'
import * as crypto from 'crypto'
import * as didJwt from 'did-jwt'
import React, { useEffect, useState } from 'react'
import { Button, Linking, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native'
import QRCode from 'react-native-qrcode-svg'
import { NavigationContainer, useFocusEffect } from '@react-navigation/native'
import { createStackNavigator } from '@react-navigation/stack'
import { Provider } from 'react-redux';

import { Settings } from './entity/settings'
import { agent, dbConnection } from './veramo/setup'
import { Identifier, appSlice, appStore } from './veramo/appSlice.ts'
import { CredentialsScreen } from './screens/SignSendToEndorser'
import { ContactsScreen, ContactImportScreen } from './screens/Contacts'

const DEFAULT_DID_PROVIDER = 'did:ethr'
const MASTER_COLUMN_VALUE = 'master'
// from https://github.com/uport-project/veramo/discussions/346#discussioncomment-302234
const UPORT_ROOT_DERIVATION_PATH = "m/7696500'/0'/0'/0'"

const newIdentifier = (address: string, publicHex: string, privateHex: string): Omit<IIdentifier, 'provider'> => {
  return {
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
}

const storeIdentifier = async (newId: Omit<IIdentifier, 'provider'>, mnemonic: string) => {

  await agent.didManagerImport(newId)

  const settings = new Settings()
  settings.id = MASTER_COLUMN_VALUE
  settings.mnemonic = mnemonic
  const conn = await dbConnection
  let newContact = await conn.manager.save(settings)
}

// Import and existing ID
const importAndStoreIdentifier = async (mnemonic: string) => {

  /**
  // an approach I pieced together
  // requires: yarn add elliptic
  // ... plus:
  // const EC = require('elliptic').ec
  // const secp256k1 = new EC('secp256k1')
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
  // requires: yarn add @ethersproject/hdnode
  // ... plus: import { HDNode } from '@ethersproject/hdnode'
  const hdnode: HDNode = HDNode.fromMnemonic(mnemonic)
  const rootNode: HDNode = hdnode.derivePath(UPORT_ROOT_DERIVATION_PATH)
  const privateHex = rootNode.privateKey.substring(2)
  const publicHex = rootNode.privateKey.substring(2)
  const address = rootNode.address
  **/

  // from https://github.com/uport-project/veramo/discussions/346#discussioncomment-302234
  const seed: Buffer = await bip39.mnemonicToSeed(mnemonic)
  const root = bip32.fromSeed(seed)
  const node = root.derivePath(UPORT_ROOT_DERIVATION_PATH)
  const privateHex = node.privateKey.toString("hex")
  const publicHex = node.publicKey.toString("hex")
  const address = didJwt.toEthereumAddress(publicHex)

  const newId = newIdentifier(address, publicHex, privateHex)
  // awaiting because otherwise the UI may not see that a mnemonic was created
  await storeIdentifier(newId, mnemonic)
  return newId

}

// Create a totally new ID
const createAndStoreIdentifier = async () => {

  // This doesn't give us the entropy/seed.
  //const id = await agent.didManagerCreate()

  const entropy = crypto.randomBytes(32)
  const mnemonic = bip39.entropyToMnemonic(entropy)

  return importAndStoreIdentifier(mnemonic)
}







/****************************************************************

 Screens

 ****************************************************************/


const Stack = createStackNavigator();

export default function App() {
  return (
    <Provider store={ appStore }>
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen name="Community Endorser" component={HomeScreen} />
          <Stack.Screen name="ContactImport" component={ContactImportScreen} />
          <Stack.Screen name="Contacts" component={ContactsScreen} />
          <Stack.Screen name="Credentials" component={CredentialsScreen} />
          <Stack.Screen name="Export Identifier" component={ExportIdentityScreen} />
          <Stack.Screen name="Help" component={HelpScreen} />
          <Stack.Screen name="Import Identifier" component={ImportIdentityScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </Provider>
  )
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
      <Button
        title="Help"
        onPress={() => navigation.navigate('Help')}
      />
    </View>
  )
}

function SettingsScreen({ navigation }) {
  const [identifiers, setIdentifiers] = useState<Identifier[]>([])
  const [hasMnemonic, setHasMnemonic] = useState<boolean>(false)

  const deleteIdentifier = async () => {
    if (identifiers.length > 0) {
      await agent.didManagerDelete(identifiers[identifiers.length - 1])
      const conn = await dbConnection
      await conn.manager.update(Settings, MASTER_COLUMN_VALUE, { mnemonic: null })
      const _ids = await agent.didManagerFind()
      setIdentifiers(_ids)
    }
  }

  const setNewId = async (id) => {
    setIdentifiers((s) => s.concat([classToPlain(id)]))
    const conn = await dbConnection
    let settings = await conn.manager.findOne(Settings, MASTER_COLUMN_VALUE)
    if (settings?.mnemonic) {
      setHasMnemonic(true)
    }
  }

  // Check for existing identifers on load and set them to state
  useEffect(() => {
    const getIdentifiers = async () => {
      const _ids = await agent.didManagerFind()
      setIdentifiers(_ids.map(classToPlain))
      const conn = await dbConnection
      let settings = await conn.manager.findOne(Settings, MASTER_COLUMN_VALUE)
      if (settings?.mnemonic) {
        setHasMnemonic(true)
      }
    }
    getIdentifiers()
  }, []) // Why does this loop infinitely with any variable, even with classToPlain(identifiers) that doesn't change?

  return (
    <SafeAreaView>
      <ScrollView>
        <View style={{ padding: 20 }}>
          <Text style={{ fontSize: 30, fontWeight: 'bold' }}>Identifier</Text>
          <View style={{ marginBottom: 50, marginTop: 20 }}>
            {identifiers?.length > 0 ? (
              identifiers.map((id: Identifier, index: number) => {
                const publicEncKey = Buffer.from(id.keys[0].publicKeyHex, 'hex').toString('base64')           
                // this is uPort's QR code format
                const shareId = {
                  iss: id.did,
                  own: {
                    publicEncKey,
                  },
                }
                return <View key={id.did} style={{ padding: 10 }}>
                  <Text
                    style={{ fontSize: 12, marginBottom: 20 }}
                    selectable={true}
                  >
                    {id.did}
                  </Text>
                  { !hasMnemonic ? (
                    <Text style={{ padding: 10, color: 'red' }}>There is no backup available. We recommend you use a different seed.</Text>
                  ) : (
                    <Text></Text>
                  )}
                  <Text style={{ marginBottom: 5 }}>Your info for sharing:</Text>
                  <QRCode value={JSON.stringify(shareId)} size={300} />
                </View>
              })
            ) : (
              <View style={{ alignItems: 'baseline', marginTop: 10 }}>
                <Text>There are no identifiers.</Text>
                <Button
                  title={'Create Identifier'}
                  onPress={() => createAndStoreIdentifier().then(setNewId)}
                />
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
            <Button title="Delete ID" onPress={deleteIdentifier} />
            <Button title="Create ID"
              onPress={() => createAndStoreIdentifier().then(setNewId)}
            />
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
    // from https://github.com/uport-project/veramo/discussions/346#discussioncomment-302234
    // ... doesn't work because hdNode.mnemonic is undefined
    const privBytes = Buffer.from(identifier.keys[0].privateKeyHex, 'hex')
    const hdNode = HDNode.fromSeed(privBytes)
    const mnemonic = hdNode.mnemonic
    **/

    const conn = await dbConnection
    const settings = await conn.manager.find(Settings)
    const mnemonic = settings[0].mnemonic

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
    importAndStoreIdentifier(mnemonic).then(() => {
      setIdentifier(newIdentifier)
      setIdChanged(true)

      // one reason redirect automatically is to force reload of ID (which doen't show if they go "back")
      setTimeout(() => navigation.popToTop(), 500)
    })
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

function HelpScreen() {
  return (
    <SafeAreaView>
      <ScrollView>
        <View style={{ padding: 20 }}>
          <Text style={{ fontWeight: 'bold' }}>What is even the purpose of this thing?</Text>
          <Text>This uses the power of cryptography to build confidence: when you make claims and your friends and family confirm those claims, you gain much more security, utility, and control in your online life.</Text>
          <Text>For an example, look at <Text style={{ color: 'blue' }} onPress={() => Linking.openURL('https://endorser.ch/reportBestAttendance')}>this report of meeting attendance</Text>.  Attendees can see their info and their contacts' info but you cannot... until someone brings you into their confidence. So state some claims, confirm others' claims, and build a network of trust -- with trustworthy communications, all verifiable cryptographically.</Text>
        </View>
        <View style={{ padding: 20 }}>
          <Text style={{ fontWeight: 'bold' }}>How do I start over?</Text>
          <Text>Uninstall and reinstall the app.  Note that this will erase the identifier (under Settings) and contacts (under... Contacts), so we recommend you export those first.</Text>
        </View>
        <View style={{ padding: 20 }}>
          <Text style={{ fontWeight: 'bold' }}>How do I export my contacts?</Text>
          <Text>On the contact screen, copy the names and DIDs to your clipboard (with the 'copy' button at the bottom) and send them to yourself (eg. by email).</Text>
        </View>
        <View style={{ padding: 20 }}>
          <Text style={{ fontWeight: 'bold' }}>How do I import my contacts?</Text>
          <Text>One-by-one, pasting from the exported contacts.</Text>
        </View>
        <View style={{ padding: 20 }}>
          <Text style={{ fontWeight: 'bold' }}>This is stupid (or fantastic). Who do I blame?</Text>
          <Text>Trent, via CommunityEndorser@gmail.com</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
