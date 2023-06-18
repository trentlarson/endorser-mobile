// Created from the setup in https://veramo.io/docs/guides/react_native

// Pull in the shims (BEFORE importing ethers)
// from https://docs.ethers.org/v5/cookbook/react-native/
import '@ethersproject/shims'
import 'react-native-gesture-handler'
import 'reflect-metadata'

import { classToPlain } from 'class-transformer'
import notifee, { AuthorizationStatus, EventType, TriggerType } from '@notifee/react-native';
import * as R from 'ramda'
import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator, Button, Image, Linking, Modal, NativeModules, Platform,
  SafeAreaView, ScrollView, Text, View
} from 'react-native'
import { requestNotifications } from 'react-native-permissions'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import Icon from 'react-native-vector-icons/FontAwesome'
import VersionNumber from 'react-native-version-number'
import { NavigationContainer, StackActions } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native'
import { createStackNavigator } from '@react-navigation/stack'
import { Provider, useSelector } from 'react-redux'

import * as pkg from '../package.json'
import { MASTER_COLUMN_VALUE, Settings } from './entity/settings'
import { styles } from './screens/style'
import { appSlice, appStore, DEFAULT_ENDORSER_API_SERVER } from './veramo/appSlice'
import { agent, dbConnection, HANDY_APP } from './veramo/setup'
import * as utility from './utility/utility.ts'
import { BVCButton } from './utility/utility.tsx'

export const ENABLE_NOTIFICATIONS = !HANDY_APP

// screen for minimal app
import { AppHandyReportScreen } from './screens/AppHandyReportFromEndorser'

import { ConfirmOthersScreen } from './screens/ConfirmOthers.tsx'
import { ConstructCredentialScreen } from './screens/ConstructCredential'
import { ContactImportScreen } from './screens/ContactImportScan.tsx'
import { ContactsScreen } from './screens/Contacts'
import { ContractFormScreen } from './screens/ContractForm'
import { EditCredentialScreen } from './screens/EditCredential';
import { ExportIdentityScreen, ImportIdentityScreen } from './screens/ExportImportIdentity'
import { InitializeScreen } from './screens/Initialize'
import { LogsScreen } from './screens/Logs'
import { MyCredentialsScreen } from './screens/MyCredentials'
import { MyGivenScreen } from './screens/MyGiven'
import { MyOffersScreen } from './screens/MyOffers'
import { NotificationPermissionsScreen } from './screens/NotificationPermissions'
import { PresentCredentialScreen } from './screens/PresentCredential'
import { ReportFeedScreen } from './screens/ReportFeed'
import { ReportScreen } from './screens/ReportFromEndorser'
import { ReviewToSignCredentialScreen } from './screens/ReviewToSignCredential'
import { ScanAnythingScreen } from './screens/ScanAnything'
import { ScanPresentationScreen } from './screens/ScanPresentation'
import { VerifyCredentialScreen } from './screens/VerifyCredential'
import { VerifyPresentationScreen } from './screens/VerifyPresentation'
import { SettingsScreen } from "./screens/Settings";
import { SignatureResultsScreen } from './screens/SignatureResults'
import { SignCredentialScreen } from './screens/SignSendToEndorser'
import { ContactCorrelateScreen } from "./screens/ContactCorrelate";
import { ContactCorrelateChoicesScreen } from "./screens/ContactCorrelateChoices";


/****************************************************************

 Screens

 ****************************************************************/



export function App() {
  return (
    <Provider store={ appStore }>
      <SafeAreaProvider>
        <NavigationContainer>
          <BottomTabs />
        </NavigationContainer>
      </SafeAreaProvider>
    </Provider>
  );
}

const BottomTab = createBottomTabNavigator();
const HOME_SCREEN_TITLE = HANDY_APP ? 'Goodlaw Signatures' : 'Community Endorser'
function BottomTabs() {
  return (
    <BottomTab.Navigator screenOptions={{ tabBarHideOnKeyboard: true }}>
      <BottomTab.Screen name={utility.CLAIMS_HOME_SCREEN_NAV} component={ClaimsStackScreen}
        options={{
          headerTitle: HOME_SCREEN_TITLE,
          tabBarIcon: ({ color, size }) => <Icon color={color} name="hand-paper-o" size={size} />,
          tabBarLabel: HANDY_APP ? 'Contracts' : 'Claims',
        }}
      />
      <BottomTab.Screen name="Contacts" component={ContactsStackScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Icon color={color} name="users" size={size} />,
        }}
      />
      <BottomTab.Screen name="Settings" component={SettingsStackScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Icon color={color} name="cog" size={size} />,
        }}
      />
    </BottomTab.Navigator>
  );
}

const ClaimsStack = createStackNavigator();

const APP_IMAGE =
  // without any 'header' spec, it leaves whitespace about this size (use 'headerTitle' for plain text)
  <View style={{ backgroundColor: 'white', height: 40, width: '100%' }}>
    {
    HANDY_APP
    ? (
      // this 'require' runs even when HANDY_APP is false... ug
      <Image
        style={{ height: 30, marginLeft: '45%', width: 30 }}
        source={ require('./image/goodlaw-icon-white.png') }
      />
    ) : (
      <View />
    )
    }
  </View>

function ClaimsStackScreen() {
  const homeScreen = HANDY_APP ? AppHandyHomeScreen : HomeScreen
  return (
    <ClaimsStack.Navigator>
      <ClaimsStack.Screen name="All Claims" component={homeScreen}
        options={{ header: () => APP_IMAGE }}
      />
      <ClaimsStack.Screen name="Confirm Others" component={ConfirmOthersScreen} />
      <ClaimsStack.Screen name="Contract Form" component={ContractFormScreen} />
      <ClaimsStack.Screen name="Create Credential" component={ConstructCredentialScreen} />
      <ClaimsStack.Screen name="Edit Credential" component={EditCredentialScreen} />
      <ClaimsStack.Screen name="Import Seed Phrase" component={ImportIdentityScreen} />
      <ClaimsStack.Screen name="Initialize" component={InitializeScreen} />
      <ClaimsStack.Screen name="Present Credential" component={PresentCredentialScreen} />
      <ClaimsStack.Screen name={utility.REPORT_FEED_SCREEN_NAV} component={ReportFeedScreen} />
      <ClaimsStack.Screen name={utility.REPORT_SCREEN_NAV} component={ReportScreen}
        options={{ headerTitle: "Search" }}
      />
      <ClaimsStack.Screen name={utility.REVIEW_SIGN_SCREEN_NAV} component={ReviewToSignCredentialScreen} />
      <ClaimsStack.Screen name="Scan Content" component={ScanAnythingScreen} />
      <ClaimsStack.Screen name="Scan Presentation" component={ScanPresentationScreen} />
      <ClaimsStack.Screen name="Sent Signature Results" component={SignatureResultsScreen} />
      <ClaimsStack.Screen name="Signature Results" component={SignCredentialScreen} />
      <ClaimsStack.Screen name="Verify Credential" component={VerifyCredentialScreen} />
      <ClaimsStack.Screen name="Verify Presentation" component={VerifyPresentationScreen} />
      <ClaimsStack.Screen name="Your Credentials" component={MyCredentialsScreen} />
      <ClaimsStack.Screen name="Your Given" component={MyGivenScreen} />
      <ClaimsStack.Screen name="Your Offers" component={MyOffersScreen} />
    </ClaimsStack.Navigator>
  )
}

const ContactsStack = createStackNavigator();
function ContactsStackScreen() {
  return (
    <ContactsStack.Navigator>
      <ContactsStack.Screen name="Contact List" component={ContactsScreen} />

      <ContactsStack.Screen name="Contact Correlate" component={ContactCorrelateScreen} />
      <ContactsStack.Screen name="Contact Correlate Choices" component={ContactCorrelateChoicesScreen} />
      <ContactsStack.Screen name="Contact Import" component={ContactImportScreen} />
    </ContactsStack.Navigator>
  )
}

const SettingsStack = createStackNavigator();
function SettingsStackScreen() {
  return (
    <SettingsStack.Navigator>
      <SettingsStack.Screen name="All Settings" component={SettingsScreen} />

      <SettingsStack.Screen name="Export Seed Phrase" component={ExportIdentityScreen} />
      <SettingsStack.Screen name={utility.HELP_SCREEN_NAV} component={HelpScreen} />
      <SettingsStack.Screen name="Import Seed Phrase" component={ImportIdentityScreen} />
      <SettingsStack.Screen name="Initialize" component={InitializeScreen} />
      <SettingsStack.Screen name="Logs" component={LogsScreen} />
      <SettingsStack.Screen name="Notification Permissions" component={NotificationPermissionsScreen} />
    </SettingsStack.Navigator>
  )
}




const initializeSettings = async () => {
  // Initialize DB, eg. settings.

  const _ids = await agent.didManagerFind()

  appStore.dispatch(appSlice.actions.addLog({log: true, msg: "... found DIDs, about to store..."}))
  appStore.dispatch(appSlice.actions.setIdentifiers(_ids.map(classToPlain)))
  appStore.dispatch(appSlice.actions.addLog({log: true, msg: "... stored DIDs, about to load settings ..."}))

  const conn = await dbConnection
  let settings = await conn.manager.findOne(Settings, MASTER_COLUMN_VALUE)
  if (!settings) {
    const initSettings = { id: MASTER_COLUMN_VALUE, apiServer: DEFAULT_ENDORSER_API_SERVER }
    settings = await conn.manager.save(Settings, initSettings)
  } else if (!settings.apiServer) {
    settings.apiServer = DEFAULT_ENDORSER_API_SERVER
    settings = await conn.manager.save(Settings, settings)
  }
  appStore.dispatch(appSlice.actions.setSettings(classToPlain(settings)))
  appStore.dispatch(appSlice.actions.addLog({log: true, msg: "... loaded settings, about to load contacts..."}))

  await utility.loadContacts(appSlice, appStore, dbConnection)
  appStore.dispatch(appSlice.actions.addLog({log: true, msg: "... finished loading contacts."}))

  return settings
}

/** unused
const { BackgroundProcessor } = NativeModules;
const logNative = () => {
  BackgroundProcessor.initializeBgTasks('stuff', () => { console.log('In yer JavaScript') })
}
**/

function HomeScreen({ navigation }) {

  const [feedCounts, setFeedCounts] = useState({})
  const [initError, setInitError] = useState<string>()
  const [loadingInitial, setLoadingInitial] = useState<boolean>(true)
  const [loadingSubfeeds, setLoadingSubfeeds] = useState<boolean>(false)
  const [loadSubfeedError, setLoadSubfeedError] = useState<string>()
  const [needsNotificationsAuthorized, setNeedsNotificationsAuthorized] = useState<boolean>(false)
  const [oldMnemonic, setOldMnemonic] = useState<boolean>(false)
  const [quickMessage, setQuickMessage] = useState<string>(null)
  const [setupFinished, setSetupFinished] = useState<boolean>(false)

  const allIdentifiers = useSelector((state) => state.identifiers)
  const allContacts = useSelector((state) => state.contacts || [])
  const settings = useSelector((state) => state.settings)

  /** see pressedInBackground usage below
  let pressedInBackground = false;
  const handleChange = (newState: any) => {
    if (newState === 'active' && pressedInBackground) {
        pressedInBackground = false
        navigation.dispatch(StackActions.push(utility.REPORT_FEED_SCREEN_NAV))
      }
    }
  };
  **/

  const checkNotify = async () => {
    const notifySettings = await notifee.getNotificationSettings()
    const channelBlocked = await notifee.isChannelBlocked(utility.DEFAULT_ANDROID_CHANNEL_ID)
    if (notifySettings && notifySettings.authorizationStatus === AuthorizationStatus.AUTHORIZED && !channelBlocked) {
      setNeedsNotificationsAuthorized(false)
    } else {
      setNeedsNotificationsAuthorized(true)
    }
  }

  const requestAndCheckNotify = async () => {
    requestNotifications([])
    .then(() => {
      checkNotify()
    })
    .catch(err => {
      console.log('Error requesting notifications (full): ', err)
      appStore.dispatch(appSlice.actions.addLog({log: true, msg: "Error requesting notifications (stringified): " + err}))
    })
    .finally(() => {
      setQuickMessage('Rechecked')
      setTimeout(() => { setQuickMessage(null) }, 1000)
    })
  }

  // Check for existing identifers on load and set them to state
  useEffect(() => {
    const getIdentifiers = async () => {
      appStore.dispatch(appSlice.actions.addLog({log: true, msg: "About to load DIDs..."}))

      try {

        const setupSettings = await initializeSettings()

        // migrate old mnemonic data
        if (setupSettings != null && setupSettings.mnemonic != null) {
          setOldMnemonic(true)
        }
        // migrate old homeScreen data from string to stringified array
        if (setupSettings.homeScreen && !setupSettings.homeScreen.startsWith('[')) {
          // it's an old value of a string key, so change it to an array
          const newHomeScreenSetting = [setupSettings.homeScreen]

          // save in DB
          const conn = await dbConnection
          await conn.manager.update(
            Settings,
            MASTER_COLUMN_VALUE,
            { homeScreen: JSON.stringify(newHomeScreenSetting) }
          )

          // save in global state
          const settings = classToPlain(appStore.getState().settings)
          settings.homeScreen = JSON.stringify(newHomeScreenSetting)
          appStore.dispatch(appSlice.actions.setSettings(settings))
        }

        setLoadingInitial(false)




        //// Now for notification setup.

        // Initialize notification channel for Android.

        if (Platform.OS === 'android') {
          const channelCreation = await notifee.createChannel({
            id: utility.DEFAULT_ANDROID_CHANNEL_ID,
            name: 'Endorser Feed',
          });
        }

        // Set up responses after clicking on notifications.
        // Note that Android opens but doesn't jump to the right screen when in background. See taskyaml:endorser.ch,2020/tasks#android-feed-screen-from-background

        // on android: Note that I get nothing from notifee when my app is in the background and a notification press brings it back.

        // on android: handles from terminated state (not from foreground or background)
        // on ios: handles from terminated state (even though docs say that getInitialNotification does nothing) so we'll skip and let the onForegroundEvent handle it
        if (Platform.OS === 'android') {
          const initNotify = await notifee.getInitialNotification()
          // note that the pressAction inside initNotify.android is typically undefined
          if (initNotify
              && initNotify.pressAction.id === utility.ANDROID_FEED_ACTION) {

            // tried customizing initNotify.pressAction.launchActivity but it always comes back as 'default'
            // might use initNotify data or id or body or title
            navigation.dispatch(StackActions.push(utility.REPORT_FEED_SCREEN_NAV))
          }
        }
        /**
        // here's my proposed functionality if we get this to work, along with code above & AppState import from react-native
        // on android: does nothing (but notifee complains about no background handler even with this here)
        // see https://github.com/invertase/notifee/issues/404
        notifee.onBackgroundEvent(async ({ type, detail }) => {
          if (type === EventType.PRESS) {
            pressedInBackground = true
          }
        })
        AppState.addEventListener('change', handleChange)
        **/
        // on android: handles when we're in the foreground -- usually (sometimes not on notifications screen)
        // on ios: handles when in the foreground or background
        notifee.onForegroundEvent(({ type, detail }) => {
          if (type === EventType.PRESS) { // iOS hits this, even when in background
            navigation.dispatch(StackActions.push(utility.REPORT_FEED_SCREEN_NAV))
          }
        })




        //// Let user know their status
        await checkNotify()





        setSetupFinished(true)

      } catch (err) {
        console.log('Got error on initial App useEffect (full):', err)
        appStore.dispatch(appSlice.actions.addLog({log: true, msg: "... got an error (stringified): " + err}))
        setInitError(
          'Something went wrong during initialization.'
          + ' Kindly send us the logs (near the bottom of Help).'
        )
      }

    }
    getIdentifiers()
  }, [])

  const loadFeedSummary = async () => {
    setLoadingSubfeeds(true)
    if (setupFinished) {
      return utility.countClaimsOfInterest(
        allContacts,
        settings.apiServer,
        allIdentifiers[0],
        settings.lastViewedClaimId
      ).then(result => {
        setFeedCounts(result)
        setLoadSubfeedError("")
        setLoadingSubfeeds(false)
      }).catch(err => {
        if (err.bodyText) {
          appStore.dispatch(appSlice.actions.addLog({
            log: true,
            msg: "Underlying error loading subfeeds: " + err.bodyText
          }))
        }
        setLoadSubfeedError("" + (err.userMessage || err))
        setLoadingSubfeeds(false)
      })
    }
  }

  // Load feed from external data
  useEffect(() => {
    loadFeedSummary()
  }, [setupFinished])

  // Potentially reload, eg. because another screen triggered a full load
  useFocusEffect(() => {
    if (appStore.getState().refreshHomeFeed) {
      appStore.dispatch(appSlice.actions.setRefreshHomeFeed(false))
      loadFeedSummary()
    }
  })

  return (
    <SafeAreaView>
      <ScrollView style={{ padding: 10 }}>

        {
        loadingInitial
        ?
          <View style={{ marginTop: '50%', marginLeft: '45%'}}>
            <Text>Loading...</Text>
          </View>
        :
          <View />
        }

        {
        initError
        ?
          <View style={{ marginTop: '50%', marginLeft: '10%', marginRight: '10%' }}>
            <Text style={{ color: 'red' }}>{initError}</Text>
          </View>
        :
          <View />
        }

        {
          allIdentifiers != null && allIdentifiers.length > 0
          ? (
            <View>

              <ScrollView style={{ borderWidth: 1, height: 100 }}>
              {
                loadSubfeedError
                ?
                  <View>
                    <Text style={{ color: 'red' }}>
                      { loadSubfeedError }
                      <Text
                        style={{ color: "blue" }}
                        onPress={ () => loadFeedSummary() }
                      >
                        &nbsp;&nbsp;&nbsp;&nbsp;Retry
                      </Text>
                    </Text>
                  </View>
                :
                  <View />
              }
              {
                loadingSubfeeds
                ? (
                  <View>
                    <Text>Checking for Activity About You or Your Friends...</Text>
                    <ActivityIndicator color="#00ff00"/>
                  </View>
                ) : (
                  (R.sum(R.values(feedCounts)) == 0)
                  ? (
                    <View>
                      <Text>No New Activity About You or Your Friends</Text>
                    </View>
                  ) : (
                    <View>
                      <Text style={{ fontWeight: 'bold' }}>
                        New Activity About You or Your Friends
                      </Text>
                      <View style={{ flexDirection: 'row' }}>

                        {/*************** Show Gives of Special Interest */}
                        {
                          feedCounts.contactGives
                          ?
                          <Text
                            style={{ padding: 10, color: "blue" }}
                            onPress={() =>
                              navigation.navigate(
                                utility.REPORT_FEED_SCREEN_NAV,
                                { subfeed: "GiveAction" }
                              )
                            }
                          >
                            { feedCounts.contactGives }
                            &nbsp;
                            Give{ feedCounts.contactGives == 1 ? "" : "s"}
                          </Text>
                          :
                          <View />
                        }

                        {/*************** Show Offers of Special Interest */}
                        {
                          feedCounts.contactOffers
                          ?
                          <Text
                            style={{ padding: 10, color: "blue" }}
                            onPress={() =>
                              navigation.navigate(
                                utility.REPORT_FEED_SCREEN_NAV,
                                { subfeed: "Offer" }
                              )
                            }
                          >
                            { feedCounts.contactOffers }
                             &nbsp;
                             Offer{ feedCounts.contactOffers == 1 ? "" : "s"}
                          </Text>
                          :
                          <View />
                        }
                      </View>

                      {/*************** Show Plans of Special Interest */}
                      <View>
                        {
                          feedCounts.contactPlans
                          ?
                          <Text
                            style={{ padding: 10, color: "blue" }}
                            onPress={() =>
                              navigation.navigate(
                                utility.REPORT_FEED_SCREEN_NAV,
                                { subfeed: "PlanAction" }
                              )
                            }
                          >
                            { feedCounts.contactPlans }
                            &nbsp;
                            Plan{ feedCounts.contactPlans == 1 ? "" : "s"}
                          </Text>
                          :
                          <View />
                        }

                        {/*************** Show Other Claims of Special Interest */}
                        {
                          feedCounts.contactOtherClaims
                          ?
                          <Text
                            style={{ padding: 10, color: "blue" }}
                            onPress={() =>
                              navigation.navigate(
                                utility.REPORT_FEED_SCREEN_NAV,
                                { subfeed: "Other" }
                              )
                            }
                          >
                            { feedCounts.contactOtherClaims }
                            &nbsp;
                            Other Claim{ feedCounts.contactOtherClaims == 1 ? "" : "s"}
                          </Text>
                          :
                          <View />
                        }
                      </View>
                    </View>
                  )
                )
              }
              </ScrollView>

              {/*************** Show Notification Message */}
              {
                needsNotificationsAuthorized
                ?
                  <View style={{ marginBottom: 20 }}>
                    <Text style={{ textAlign: 'center' }}>
                      Note: you will not get notified of new claims.
                      &nbsp;
                      <Icon name="info-circle" onPress={() => navigation.navigate('Notification Permissions')} />
                    </Text>
                    <Text style={{ textAlign: 'center' }}>
                      <Text
                        style={{ color: 'blue' }}
                        onPress={() => requestAndCheckNotify()}
                      >
                        Allow
                      </Text>
                    </Text>
                  </View>
                :
                  <View />
              }

              {/*************** Show Customized Actions */}
              {settings != null && settings.homeScreen && settings.homeScreen.indexOf('"Gave"') !== -1
                ? (
                  <View style={{ marginTop: 5 }}>
                    <Button
                      title={'Gave'}
                      onPress={() => {
                        const giveClaim = {
                          "@context": utility.SCHEMA_ORG_CONTEXT,
                          "@type": "GiveAction",
                          recipient: { identifier: allIdentifiers[0] },
                        }
                        navigation.navigate('Create Credential', { incomingClaim: giveClaim })
                      }}
                    />
                    <View style={{ marginBottom: 40 }}/>
                  </View>
                ) : (
                  <View />
                )}

              {settings != null && settings.homeScreen && settings.homeScreen.indexOf('"BVC"') !== -1
              ? (
                <View style={{ marginTop: 5 }}>
                  <Text style={{ textAlign: 'center' }}>Bountiful Voluntaryist Community Saturday Meeting</Text>
                  <BVCButton
                    description='Meeting'
                    identifier={ allIdentifiers[0] }
                    navigation={ navigation }
                  />
                  <View style={{ marginTop: 5 }}/>
                  <Button
                    title={'Confirm Others'}
                    onPress={() => navigation.navigate('Confirm Others')}
                  />
                  <View style={{ marginBottom: 40 }}/>
                </View>
              ) : ( // it's not the BVC home screen
                <View />
              )}

              {/*************** Finally, show all the generic actions */}
              <View style={{ marginTop: 5 }}/>
              <Button
                title="Claim / Ask / Offer"
                onPress={() => navigation.navigate('Create Credential')}
              />
              <View style={{ marginTop: 5 }}/>
              <Button
                title={"Agree / Certify / Confirm"}
                onPress={() => navigation.navigate('Confirm Others')}
              />

              <View style={{ marginTop: 40 }}/>
              <Button
                title="View Feed"
                onPress={() => navigation.navigate(utility.REPORT_FEED_SCREEN_NAV)}
              />
              <View style={{ marginTop: 5 }}/>
              <Button
                title="Search"
                onPress={() => navigation.navigate(utility.REPORT_SCREEN_NAV)}
              />
              <View style={{ marginTop: 5 }}/>
              <Button
                title="Scan A Presented Claim"
                onPress={() => navigation.navigate('Scan Presentation')}
              />
              <View style={{ marginTop: 100 }}/>
              {oldMnemonic ? (
                <View style={{ marginTop: 10, marginBottom: 10 }}>
                  <Text style={{ color: 'red', textAlign: 'center' }}>Your identity is not encrypted.</Text>
                  <Button
                    title="Encrypt Your Identity"
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
                title="Create New Keys"
                onPress={() => navigation.navigate('Initialize')}
              />
              <View style={{ marginTop: 5 }}/>
              <Button
                title="Import Keys"
                onPress={() => navigation.navigate('Import Seed Phrase')}
              />
              <View style={{ marginTop: 5 }}/>
              <Button
                title="Scan A Presented Claim"
                onPress={() => navigation.navigate('Scan Presentation')}
              />
            </View>
          )
        }

      <Modal
        animationType="slide"
        transparent={true}
        visible={!!quickMessage}
      >
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <Text>{ quickMessage }</Text>
          </View>
        </View>
      </Modal>

      </ScrollView>
    </SafeAreaView>
  )
}

function AppHandyHomeScreen({ navigation }) {

  const [initError, setInitError] = useState<string>()
  const [loadingInitial, setLoadingInitial] = useState<boolean>(true)

  const allIdentifiers = useSelector((state) => state.identifiers)
  const settings = useSelector((state) => state.settings)

  // Check for existing identifers on load and set them to state
  useEffect(() => {
    const getIdentifiers = async () => {
      appStore.dispatch(appSlice.actions.addLog({log: true, msg: "About to load DIDs..."}))

      try {

        await initializeSettings()

        setLoadingInitial(false)

      } catch (err) {
        console.log('Got error on initial App useEffect (full):', err)
        appStore.dispatch(appSlice.actions.addLog({log: true, msg: "... got an error (stringified): " + err}))
        setInitError('Something went wrong during initialization. Kindly send us the logs (near the bottom of Help).')
      }


    }
    getIdentifiers()
  }, [])

  return (
    <SafeAreaView>
      <ScrollView style={{ padding: 10 }}>
        {
        loadingInitial
        ?
          <View style={{ marginTop: '50%', marginLeft: '45%'}}>
            <Text>Loading...</Text>
          </View>
        :
          <View />
        }

        {
        initError
        ?
          <View style={{ marginTop: '50%', marginLeft: '10%', marginRight: '10%' }}>
            <Text style={{ color: 'red' }}>{initError}</Text>
          </View>
        :
          <View />
        }

        {
          allIdentifiers != null && allIdentifiers.length > 0
          ? (
            <View>
              <View style={{ marginTop: 5 }}/>
              <Button
                title="Sign Contract"
                onPress={() => navigation.navigate('Create Credential')}
              />
              <View style={{ marginTop: 5 }}/>
              <Button
                title="Verify Counterparty's Signature"
                onPress={() => navigation.navigate('Scan Presentation')}
              />
              <View style={{ marginTop: 5 }}/>
              <Button
                title="Search"
                onPress={() => navigation.navigate(utility.REPORT_SCREEN_NAV)}
              />
              <View style={{ marginTop: 100 }}/>
            </View>
          ) : ( // there are no identifiers
            <View>
              <Button
                title="Create New Keys"
                onPress={() => navigation.navigate('Initialize')}
              />
              <View style={{ marginTop: 5 }}/>
              <Button
                title="Import Keys"
                onPress={() => navigation.navigate('Import Seed Phrase')}
              />
              <View style={{ marginTop: 5 }}/>
              <Button
                title="Verify Counterparty's Signature"
                onPress={() => navigation.navigate('Scan Presentation')}
              />
            </View>
          )
        }

      </ScrollView>
    </SafeAreaView>
  )
}

function HelpScreen() {

  const logMessageSelector = useSelector((state) => state.logMessage)

  return (
    <SafeAreaView>
      <ScrollView>
        <View style={{ padding: 20 }}>
          <Text style={{ fontWeight: 'bold' }}>How does this help me?</Text>
          <Text style={{ padding: 5 }}>This uses the power of cryptography to build confidence: when you make claims and then your friends and family confirm those claims, you gain much more utility, control, and security in your online life.</Text>
          <Text style={{ padding: 5 }}>For an example, look at <Text style={{ color: 'blue' }} onPress={() => Linking.openURL('https://endorser.ch/reportBestAttendance')}>this report of meeting attendance on the Endorser server</Text>.  Attendees can see their own info and their contacts' info but you cannot see it... until someone brings you into their confidence. So make some claims, confirm others' claims, and build a network of trust -- with trustworthy communifcations, all verifiable cryptographically.</Text>
          <Text style={{ padding: 5, color: 'blue' }} onPress={() => Linking.openURL('https://endorser.ch/docs')}>For more info, see the Docs section on the Endorser server.</Text>
        </View>

        <View style={{ padding: 20 }}>
          <Text style={{ fontWeight: 'bold' }}>What data is visible to others?</Text>
          <Text style={{ padding: 5 }}>All data that you enter except for your ID is visible to everyone. Yes, that means anyone in the world can see those data points, so don't type in any personally identifiable information.</Text>
          <Text style={{ padding: 5 }}>Your ID is visible only to people who you allow.</Text>
          <Text style={{ padding: 5 }}>Your contact list is not saved to a server and not revealed to any other users (although they may check if they are visible to you).</Text>
          <Text style={{ padding: 5 }}>See the <Text style={{ color: 'blue' }} onPress={() => Linking.openURL('https://endorser.ch/privacy-policy')}>Privacy Policy</Text> for more information.</Text>
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
          <Text style={{ fontWeight: 'bold' }}>How do I delete a contact?</Text>
          <Text style={{ padding: 5 }}>Go to Test Mode (under Settings under Advanced Mode), and then you can delete any contact. But beware: there is currently no prompt for safety, so be careful... and after deleting, go back and exit Test Mode right away.</Text>
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
          <Text style={{ fontWeight: 'bold' }}>Who do I call out for this?</Text>
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
          <Text style={{ padding: 5 }} selectable={true}>
            Version { pkg.version } ({ VersionNumber.buildVersion })
            { logMessageSelector }
          </Text>
        </View>

        { Platform.OS === 'android'
          ?
            <View style={{ padding: 20 }}>
              <Text style={{ fontWeight: 'bold' }}>Should I upgrade?</Text>
              <Text style={{ padding: 5 }}>Check <Text style={{ color: 'blue' }} onPress={() => Linking.openURL('https://play.google.com/store/apps/details?id=ch.endorser.mobile')}>here in the Play Store</Text>.</Text>
            </View>
          : Platform.OS === 'ios'
            ?
              <View style={{ padding: 20 }}>
               <Text style={{ fontWeight: 'bold' }}>Should I to upgrade?</Text>
               <Text style={{ padding: 5 }}>Check <Text style={{ color: 'blue' }} onPress={() => Linking.openURL('https://apps.apple.com/us/app/endorser-mobile/id1556368693')}>here in the App Store</Text>.</Text>
              </View>
            :
              <Text/>
        }

      </ScrollView>
    </SafeAreaView>
  )
}
