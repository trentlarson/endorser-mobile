// Created from the setup in https://veramo.io/docs/guides/react_native

import 'react-native-gesture-handler'
import 'reflect-metadata'
import React from 'react'
import { Button, Linking, SafeAreaView, ScrollView, Text, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { NavigationContainer } from '@react-navigation/native'
import { createStackNavigator } from '@react-navigation/stack'
import { Provider } from 'react-redux';

import * as pkg from '../package.json'
import { MASTER_COLUMN_VALUE, Settings } from './entity/settings'
import { agent, dbConnection } from './veramo/setup'
import { appStore } from './veramo/appSlice.ts'
import { CredentialsScreen } from './screens/SignSendToEndorser'
import { ContactImportScreen, ContactsScreen } from './screens/Contacts'
import { ExportIdentityScreen, ImportIdentityScreen, SettingsScreen } from "./screens/Settings";







/****************************************************************

 Screens

 ****************************************************************/


const Stack = createStackNavigator();

export default function App() {
  return (
    <Provider store={ appStore }>
      <SafeAreaProvider>
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
      </SafeAreaProvider>
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

function HelpScreen() {
  return (
    <SafeAreaView>
      <ScrollView>
        <View style={{ padding: 20 }}>
          <Text style={{ fontWeight: 'bold' }}>What is even the purpose of this thing?</Text>
          <Text>This uses the power of cryptography to build confidence: when you make claims and your friends and family confirm those claims, you gain much more security, utility, and control in your online life.</Text>
          <Text>For an example, look at <Text style={{ color: 'blue' }} onPress={() => Linking.openURL('https://endorser.ch/reportBestAttendance')}>this report of meeting attendance</Text>.  Attendees can see their own info and their contacts' info but you cannot see it... until someone brings you into their confidence. So... make some claims, confirm others' claims, and build a network of trust -- with trustworthy communications, all verifiable cryptographically.</Text>
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
          <Text style={{ fontWeight: 'bold' }}>Why do I see warnings about a missing backup?</Text>
          <Text>Without a backup, this identifier is gone forever if you lose this device, and with it you lose the ability to verify yourself and your claims and your credentials. We beg of you: wipe your data now (after exporting your contacts) and create a new one that you can safely use to build reputation.</Text>
        </View>
        <View style={{ padding: 20 }}>
          <Text style={{ fontWeight: 'bold' }}>How do I generate a different identifier?</Text>
          <Text>Note that this will erase the identifier (under Settings) and contacts (under... Contacts), so we recommend you export those first.</Text>
          <Text>- On Android, you can go to the Storage in App Info and clear it. Remember to export your data!</Text>
          <Text>- On iOS, the easiest way is to uninstall and reinstall the app. Remember to export your data!</Text>
          <Text>(If you expect better functionality: yes, it's on the radar.)</Text>
        </View>
        <View style={{ padding: 20 }}>
          <Text style={{ fontWeight: 'bold' }}>This is stupid (or fantastic). Who do I blame?</Text>
          <Text>Trent, via: </Text><Text selectable={true}>CommunityEndorser@gmail.com</Text>
        </View>
        <View style={{ padding: 20 }}>
          <Text style={{ fontWeight: 'bold' }}>What is the version info?</Text>
          <Text selectable={true}>{ pkg.version }</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
