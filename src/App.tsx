// Created from the setup in https://veramo.io/docs/guides/react_native

import 'react-native-gesture-handler'
import 'reflect-metadata'

import { classToPlain } from 'class-transformer'
import React, { useEffect, useState } from 'react'
import { Button, Linking, Platform, SafeAreaView, ScrollView, Text, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import VersionNumber from 'react-native-version-number'
import { NavigationContainer } from '@react-navigation/native'
import { createStackNavigator } from '@react-navigation/stack'
import { Provider, useSelector } from 'react-redux';

import * as pkg from '../package.json'
import { MASTER_COLUMN_VALUE, Settings } from './entity/settings'
import { ConfirmOthersScreen } from './screens/ConfirmOthers.tsx'
import { ConstructCredentialScreen } from './screens/ConstructCredential'
import { SignCredentialScreen } from './screens/SignSendToEndorser'
import { ContactImportScreen } from './screens/ContactImportScan.tsx'
import { ContactsScreen } from './screens/Contacts'
import { ExportIdentityScreen, ImportIdentityScreen, SettingsScreen } from "./screens/Settings";
import { MyCredentialsScreen } from './screens/MyCredentials'
import { PresentCredentialScreen } from './screens/PresentCredential'
import { ReportScreen } from './screens/ReportFromEndorser'
import { ScanPresentationScreen, VerifyCredentialScreen } from './screens/VerifyCredential'
import { appSlice, appStore } from './veramo/appSlice'
import { agent, dbConnection } from './veramo/setup'
import * as utility from './utility/utility.ts'
import { BVCButton } from './utility/utility.tsx'






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
            <Stack.Screen name="Confirm Others" component={ConfirmOthersScreen} />
            <Stack.Screen name="Contact Import" component={ContactImportScreen} />
            <Stack.Screen name="Contacts" component={ContactsScreen} />
            <Stack.Screen name="Sign Credential" component={SignCredentialScreen} />
            <Stack.Screen name="Create Credential" component={ConstructCredentialScreen} />
            <Stack.Screen name="Export Seed Phrase" component={ExportIdentityScreen} />
            <Stack.Screen name="Help" component={HelpScreen} />
            <Stack.Screen name="Import Seed Phrase" component={ImportIdentityScreen} />
            <Stack.Screen name="My Credentials" component={MyCredentialsScreen} />
            <Stack.Screen name="Present Credential" component={PresentCredentialScreen} />
            <Stack.Screen name="Reports from Endorser server" component={ReportScreen} />
            <Stack.Screen name="Scan Presentation" component={ScanPresentationScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="Verify Credential" component={VerifyCredentialScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </Provider>
  )
}

function HomeScreen({ navigation }) {
  const [loading, setLoading] = useState<boolean>(true)
  const [oldMnemonic, setOldMnemonic] = useState<boolean>(false)

  const allIdentifiers = useSelector((state) => state.identifiers)
  const settings = useSelector((state) => state.settings)

  // Check for existing identifers on load and set them to state
  useEffect(() => {
    const getIdentifiers = async () => {
      const _ids = await agent.didManagerFind()
      appStore.dispatch(appSlice.actions.setIdentifiers(_ids.map(classToPlain)))

      const conn = await dbConnection
      const settings = await conn.manager.findOne(Settings, MASTER_COLUMN_VALUE)
      appStore.dispatch(appSlice.actions.setSettings(classToPlain(settings)))

      setLoading(false)

      utility.loadContacts(appSlice, appStore, dbConnection)

      if (settings.mnemonic != null) {
        setOldMnemonic(true)
      }
    }
    getIdentifiers()
  }, [])

  return (
    <View>
      {
      loading
      ? (
        <View style={{ marginLeft: '45%', marginTop: '50%' }}>
          <Text>Loading...</Text>
        </View>
      ) : ( // not loading
        allIdentifiers != null && allIdentifiers.length > 0
        ? (
          <View>
            {settings != null && settings.homeScreen === 'BVC'
            ? (
              <View>
                <View style={{ marginBottom: 100 }}/>
                <Text style={{ textAlign: 'center' }}>Bountiful Voluntaryist Community Saturday Meeting</Text>
                <BVCButton
                  description='Meeting'
                  identifier={ allIdentifiers[0] }
                  navigation={ navigation }
                />
                <Button
                  title={'Confirm Others'}
                  onPress={() => navigation.navigate('Confirm Others')}
                />
                <View style={{ marginBottom: 100 }}/>
              </View>
            ) : ( // it's not the BVC home screen
              <View />
            )}
            <Button
              title="Claim / Ask / Offer"
              onPress={() => navigation.navigate('Create Credential')}
            />
            <Button
              title={'Agree / Certify / Confirm'}
              onPress={() => navigation.navigate('Confirm Others')}
            />
            <Button
              title="Search"
              onPress={() => navigation.navigate('Reports from Endorser server')}
            />
            <Button
              title="Scan Signatures"
              onPress={() => navigation.navigate('Scan Presentation')}
            />
            <View style={{ marginTop: 100 }}/>
            <Button
              title="Manage Contacts"
              onPress={() => navigation.navigate('Contacts')}
            />
            <Button
              title="Manage Profile & Settings"
              onPress={() => navigation.navigate('Settings')}
            />
            {oldMnemonic ? (
              <View style={{ marginTop: 50 }}>
                <Text style={{ color: 'red', textAlign: 'center' }}>Your data is not secure.</Text>
                <Button
                  title="Click to secure your mnemonic seed phrase."
                  onPress={() => navigation.navigate('Import Seed Phrase')}
                />
              </View>
            ) : (
              <View/>
            )}
          </View>
        ) : ( // there are no identifiers
          <View>
            <Button
              title="Create New Identifier"
              onPress={() => navigation.navigate('Settings')}
            />
            <Button
              title="Import Seed Phrase"
              onPress={() => navigation.navigate('Import Seed Phrase')}
            />
            <View style={{ marginTop: 100 }}/>
            <Button
              title="Scan Presentation"
              onPress={() => navigation.navigate('Scan Presentation')}
            />
          </View>
        )
      )
      }
      <Button
        title="Get Help"
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
          <Text style={{ padding: 5 }}>This uses the power of cryptography to build confidence: when you make claims and then your friends and family confirm those claims, you gain much more utility, control, and security in your online life.</Text>
          <Text style={{ padding: 5 }}>For an example, look at <Text style={{ color: 'blue' }} onPress={() => Linking.openURL('https://endorser.ch/reportBestAttendance')}>this report of meeting attendance on the Endorser server</Text>.  Attendees can see their own info and their contacts' info but you cannot see it... until someone brings you into their confidence. So make some claims, confirm others' claims, and build a network of trust -- with trustworthy communications, all verifiable cryptographically.</Text>
          <Text style={{ padding: 5, color: 'blue' }} onPress={() => Linking.openURL('https://endorser.ch/docs')}>For more info, see the Docs section on the Endorser server.</Text>
        </View>

        <View style={{ padding: 20 }}>
          <Text style={{ fontWeight: 'bold' }}>How do I backup/export/import my identifier?</Text>
          <Text style={{ padding: 5 }}>On the Settings screen, scroll down and click 'Export Identifier', then show the "mnemonic phrase". Be careful to do this in a safe place! If you want to keep it secure then don't save it anywhere unencrypted... and if you don't already have a secure, encrypted location then it's not a bad idea to store it offline, meaning written down and locked away from everyone else.</Text>
          <Text style={{ padding: 5 }}>One more thing: your identifier has a specific "derivation path" listed in your settings, so copy that as well. (This is the default derivation path for this app, but if you use another app then you may have to give it to that app.)</Text>
        </View>

        <View style={{ padding: 20 }}>
          <Text style={{ fontWeight: 'bold' }}>Why do I see warnings about a missing backup?</Text>
          <Text style={{ padding: 5 }}>Some error has messed with your underlying seed phrase backup. Without a backup, this identifier is gone forever if you lose this device, and with it you lose the ability to verify yourself and your claims and your credentials. If you see that message and you haven't done a backup already, we beg of you: wipe your data now (after exporting your contacts) and create a new one that you can safely use to build reputation.</Text>
        </View>

        <View style={{ padding: 20 }}>
          <Text style={{ fontWeight: 'bold' }}>How do I change my mnemonic seed phrase password?</Text>
          <Text style={{ padding: 5 }}>First, export your phrase. Then go into Test Mode (under Settings and Advanced Mode) and click "Import ID" to import that phrase with the new password.</Text>
        </View>

        <View style={{ padding: 20 }}>
          <Text style={{ fontWeight: 'bold' }}>How do I backup/export/import my contacts?</Text>
          <Text style={{ padding: 5 }}>On the Contacts screen, click on "Copy All to Clipboard (CSV)" and send them to yourself (eg. by email).  You can then import them with the "Import Bulk (CSV)" on the same screen.</Text>
        </View>

        <View style={{ padding: 20 }}>
          <Text style={{ fontWeight: 'bold' }}>How do I generate a different identifier?</Text>
          <Text style={{ padding: 5 }}>One way is to go to Test Mode (under Settings under Advanced Mode), and then you can delete your current identifier and generate a new one.</Text>
          <Text style={{ padding: 5 }}>Here's another way, but note that this will erase the identifier and contacts, so we recommend you backup those first by following the instructions above.</Text>
          <Text style={{ padding: 5 }}>- On Android, you can go to the Storage in App Info and clear it. Remember to export your data first!</Text>
          <Text style={{ padding: 5 }}>- On iOS, the easiest way is to uninstall and reinstall the app. Remember to export your data first!</Text>
          <Text style={{ padding: 5 }}>(I know you expect better functionality and it's on the radar.)</Text>
        </View>

        <View style={{ padding: 20 }}>
          <Text style={{ fontWeight: 'bold' }}>This is stupid (or fantastic). Who do I blame?</Text>
          <Text style={{ padding: 5 }}>Trent, via:</Text>
          <Text style={{ padding: 5 }} selectable={true}>CommunityEndorser@gmail.com</Text>
        </View>

        <View style={{ padding: 20 }}>
          <Text style={{ fontWeight: 'bold' }}>Who else do we have to thank?</Text>
          <Text style={{ padding: 5 }}>
            Specs like&nbsp;
            <Text style={{ color: 'blue' }} onPress={() => Linking.openURL('https://www.w3.org/TR/vc-data-model/')}>
              Verifiable Credentials
            </Text>
            &nbsp;supported by&nbsp;
            <Text style={{ color: 'blue' }} onPress={() => Linking.openURL('https://www.w3.org/')}>
              W3C
            </Text>
            &nbsp;and&nbsp;
            <Text style={{ color: 'blue' }} onPress={() => Linking.openURL('https://trustoverip.org/')}>
              the Apache Trust over IP Foundation
            </Text>
            &nbsp;and&nbsp;
            <Text style={{ color: 'blue' }} onPress={() => Linking.openURL('https://sovrin.org/')}>
              Sovrin
            </Text>
            &nbsp;and initiated by&nbsp;
            <Text style={{ color: 'blue' }} onPress={() => Linking.openURL('https://internetidentityworkshop.com/')}>
              IIW
            </Text>
          </Text>
          <Text style={{ padding: 5 }}>
            <Text style={{ color: 'blue' }} onPress={() => Linking.openURL('https://veramo.io')}>
              Veramo
            </Text>
            &nbsp;and its predecessor&nbsp;
            <Text style={{ color: 'blue' }} onPress={() => Linking.openURL('https://uport.me')}>
              uPort
            </Text>
          </Text>
          <Text style={{ padding: 5 }}>
            <Text style={{ color: 'blue' }} onPress={() => Linking.openURL('https://reactnative.dev/')}>
              React-Native
            </Text>
            &nbsp;and Android and iOS
          </Text>
        </View>

        <View style={{ padding: 20 }}>
          <Text style={{ fontWeight: 'bold' }}>What info should I provide in feedback?</Text>
          <Text style={{ padding: 5 }} selectable={true}>Version { pkg.version } ({ VersionNumber.buildVersion })</Text>
        </View>

        { Platform.OS === 'android'
          ?
            <View style={{ padding: 20 }}>
              <Text style={{ fontWeight: 'bold' }}>Do I need to upgrade?</Text>
              <Text style={{ padding: 5 }}>Double-check in <Text style={{ color: 'blue' }} onPress={() => Linking.openURL('https://play.google.com/store/apps/details?id=ch.endorser.mobile')}>here in the Play Store</Text>.</Text>
            </View>
          : Platform.OS === 'ios'
            ?
              <View style={{ padding: 20 }}>
               <Text style={{ fontWeight: 'bold' }}>Do I need to upgrade?</Text>
               <Text style={{ padding: 5 }}>Double-check <Text style={{ color: 'blue' }} onPress={() => Linking.openURL('https://apps.apple.com/us/app/endorser-mobile/id1556368693')}>here in the App Store</Text>.</Text>
              </View>
            :
              <Text/>
        }

      </ScrollView>
    </SafeAreaView>
  )
}
