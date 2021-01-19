import 'react-native-gesture-handler'
import { entropyToMnemonic, mnemonicToEntropy } from 'bip39'
import React, { useEffect, useState } from 'react'
import { SafeAreaView, ScrollView, View, Text, TextInput, Button } from 'react-native'
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

// Import agent from setup
import { agent } from './veramo/setup'

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

  const deleteIdentifiers = async () => {
    if (identifiers.length > 0) {
      await agent.didManagerDelete(identifiers[0])
      const _ids = await agent.didManagerFind()
      setIdentifiers(_ids)
    } else {
      throw Error('There are no identifiers to delete.')
    }
  }

  // Check for existing identifers on load and set them to state
  useEffect(() => {
    const getIdentifiers = async () => {
      const _ids = await agent.didManagerFind()
      setIdentifiers(_ids)

      // Inspect the id object in your debug tool
      console.log('_ids:', _ids)
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
                <Text>No identifiers created yet</Text>
                <Button title={'Create Identifier'} onPress={() => createIdentifier()}  />
              </View>
            )}
          </View>
          <View style={{ alignItems: 'baseline', marginBottom: 50, marginTop: 100 }}>
            <Button
              title="Import Identifier"
              onPress={() => navigation.navigate('ImportIdentity')}
            />
            <Button
              title="Export Identifier"
              onPress={() => navigation.navigate('ExportIdentity')}
            />
            {/** good for tests, bad for users
            <Button
              title="Delete Identifiers"
              onPress={() => deleteIdentifiers()}
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
    let key = entropyToMnemonic(identifier.keys[0].privateKeyHex)
    setMnemonic(key)
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
            <Text>{identifier.did}</Text>
            <Button title={'Export Identifier Mnemonic'} onPress={() => exportIdentifier()} />
            <Text selectable={true}>{ mnemonic }</Text>
          </View>
        ) : (
          <View> 
            <Text>No identifiers have been created yet.</Text>
          </View>
        )}
      </View>
    </View>
  )
}

function ImportIdentityScreen({ navigation }) {
  const [identifier, setIdentifier] = useState<Identifier>()
  const [mnemonic, setMnemonic] = useState<String>('')

  // Check for existing identifers on load and set them to state
  useEffect(() => {
    const getIdentifiers = async () => {
      const _ids = await agent.didManagerFind()
      setIdentifier(_ids[0])
    }
    getIdentifiers()
  }, [])

  const importIdentifier = async () => {
    const keyHex = mnemonicToEntropy(mnemonic)
    const key = await agent.didManagerAddKey(keyHex)
    console.log('new key', key)
  }

  return (
    <SafeAreaView>
      <ScrollView>
        <View style={{ padding: 20 }}>
          <Text style={{ fontSize: 30, fontWeight: 'bold' }}>Enter Mnemonic</Text>
          <View style={{ marginBottom: 50, marginTop: 20 }}>
            {identifier ? (
              <View>
                <Text>An identifier is already created.</Text>
              </View>
              ) : (
              <View>
                <Text>{identifier && identifier.did}</Text>
                <TextInput
                  multiline={true}
                  style={{ borderWidth: 1, height: 100 }}
                  onChangeText={(text) => setMnemonic(text)}
                >
                </TextInput>
                <Button title={'Import from mnemonic'} onPress={() => importIdentifier()} />
              </View>
            )}
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
        <Stack.Screen name="ExportIdentity" component={ExportIdentityScreen} />
        <Stack.Screen name="ImportIdentity" component={ImportIdentityScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  )
}

export default App
