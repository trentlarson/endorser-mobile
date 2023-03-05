
import notifee, { AuthorizationStatus, TriggerType } from '@notifee/react-native';
import React, { useEffect, useState } from 'react'
import { Button, Modal, Platform, SafeAreaView, ScrollView, Text, View } from "react-native"
import { openSettings, requestNotifications } from 'react-native-permissions'

import { appSlice, appStore } from "../veramo/appSlice"
import * as utility from "../utility/utility"
import { styles } from './style'

/**
  See test scenarios in README.md
  See flow reference: https://github.com/zoontek/react-native-permissions/blob/master/README.md#ios-flow
 **/
export function NotificationPermissionsScreen() {

  const FINISHED_MESSAGE = 'Finished'

  const [canNotify, setCanNotify] = useState<boolean>()
  const [isBlocked, setIsBlocked] = useState<boolean>()
  const [lastCheckText, setLastCheckText] = useState<string>()
  const [someError, setSomeError] = useState<string>()
  const [quickMessage, setQuickMessage] = useState<string>(null)

  const checkSettings = async () => {

    setLastCheckText(
      appStore.getState().settings.lastDailyTaskTime
      ? appStore.getState().settings.lastDailyTaskTime.replace("T", " ").replace("Z", " UTC")
      : 'not run yet'
    )

    const storedSettings = await notifee.getNotificationSettings()
    const channelBlocked = await notifee.isChannelBlocked(utility.DEFAULT_ANDROID_CHANNEL_ID)
    appStore.dispatch(appSlice.actions.addLog({
      log: true,
      msg: "Notification settings: " + JSON.stringify(storedSettings) + " && " + channelBlocked
    }))

    let isAuthorized = false
    if (storedSettings.authorizationStatus === AuthorizationStatus.DENIED || channelBlocked) {
      setCanNotify(false)
      setIsBlocked(true)
    } else if (storedSettings.authorizationStatus === AuthorizationStatus.AUTHORIZED) {
      setCanNotify(true)
      isAuthorized = true
    } else {
      setCanNotify(null)
    }

    appStore.dispatch(appSlice.actions.addLog({
      log: true,
      msg: "Notifications are" + (isAuthorized ? "" : " not") + " authorized."
    }))
  }

  const checkSettingsAndReport = async () => {
    await checkSettings()
    setQuickMessage('Checked')
    setTimeout(() => { setQuickMessage(null) }, 1000)
  }

  const enableNotifications = async () => {

    /**
    // Doesn't always work (ie. after reinstall); see https://github.com/invertase/notifee/issues/432
    // (not making high-priority notification... there's no need to display things urgently)
    const permSettings = await notifee.requestPermission({ alert: false, badge: false, carPlay: false, sound: false });
    **/

    const permSettings = await requestNotifications([])
    return checkSettingsAndReport()
  }

  const openPhoneSettings = () => {
    openSettings()
    .then(() => setSomeError(null))
    .catch(() => setSomeError(
      "Got an error opening your phone Settings. To enable notifications"
      + " manually, go to your phone 'Settings' app and then select"
      + " 'Notifications' and then choose this app and turn them on."
    ))
  }

  const killToggle = utility.Toggle()

  const runDailyCheck = async () => {
    const task = require('../utility/backgroundTask')(killToggle)
    const result = await task()

    appStore.dispatch(appSlice.actions.setLastDailyTaskTime())
    setLastCheckText(() =>
      appStore.getState().settings.lastDailyTaskTime.replace("T", " ").replace("Z", " UTC")
    )

    setQuickMessage(FINISHED_MESSAGE)
    setTimeout(() => { setQuickMessage(null) }, 1000)
    if (result) {
      setSomeError(result)
    } else {
      setSomeError(null)
    }
  }

  const toggleToKill = async () => {
    killToggle.setToggle(true)
  }

  const createTestNotification = async () => {
    await notifee.displayNotification({
      title: 'Test Succeeded',
      body: 'This shows that Endorser notifications work.',
      android: {
        channelId: utility.DEFAULT_ANDROID_CHANNEL_ID,
        pressAction: {
          id: utility.ANDROID_FEED_ACTION, // launch the application on press
        }
        //smallIcon: 'name-of-a-small-icon', // optional, defaults to 'ic_launcher'.
      },
    })
  }

  useEffect(() => {
    checkSettings()
  }, [])

  return (
    <SafeAreaView>
      <ScrollView>
        <View style={{padding: 20}}>
          <Text style={{fontSize: 30, fontWeight: 'bold'}}>Notification Permissions</Text>

          <View style={{ marginTop: 20 }} />

          <View>

            <Text style={{ marginBottom: 20 }}>
              <Text style={{ fontWeight: 'bold' }}>Status:</Text>
              &nbsp;
              {
                canNotify == null
                ?
                <Text>Unsure whether you will get notifications.</Text>
                :
                  canNotify == false
                  ?
                  isBlocked
                  ?
                    <Text>
                      Notifications are blocked.
                      To be notified of new activity, you must enable them in your phone settings.&nbsp;
                      <Text style={{ color: 'blue' }} onPress={ openPhoneSettings }>
                        Click here to enable Notifications in your phone settings.
                      </Text>
                    </Text>
                    :
                    // canNotify == false && !isBlocked
                    <Text>You will not get notifications.</Text>
                  :
                    // canNotify must be true
                    <Text>You will get notifications.</Text>
              }
            </Text>

            <Text>This app can notify you if people make commitments or confirmations of interest.</Text>
            <View style={{ marginTop: 10 }} />
            <Text>If you're not getting notifications:</Text>
            <View style={{ padding: 10 }}>
              {
                Platform.OS === 'android'
                ?
                  <Text style={{ marginBottom: 10 }}>- Note that the notification will not take you to the feed screen if the app is in the background. You can quit this app and it will notify you and take you to your feed.</Text>
                :
                  <View />
              }
              {
                Platform.OS === 'ios'
                ?
                  <Text style={{ marginBottom: 10 }}>- Do not quit the app, but rather push it to the background (eg. by going to the home screen, or by opening another app). iOS notifications only work when the app stays in the background; they do not work when the app is closed.</Text>
                :
                  <View />
              }
              <Text style={{ marginBottom: 10 }}>- Try some of the actions below, and see Help to report problems.</Text>
            </View>
          </View>

          <Text>Last Check: { lastCheckText }</Text>

          {
            someError
            ? <Text style={{ color: 'red' }}>{ someError }</Text>
            : <View />
          }

          <Text style={{ fontWeight: 'bold', marginTop: 20 }}>Actions</Text>
          <View style={{ marginLeft: 10}}>

            <Text>After running these actions, you may see more detail in the logs.</Text>

            {
              !canNotify
              ?
                <Text style={{ color: 'blue', marginTop: 20 }} onPress={ enableNotifications }>
                  Allow this app to enable Notifications.
                </Text>
              :
                <View />
            }

            <Text style={{ color: 'blue', marginTop: 20 }} onPress={ checkSettingsAndReport }>
              Double-check your settings in this app.
            </Text>
            <Text style={{ marginLeft: 10 }}>You might fix the Status above by doing this.</Text>

            <Text style={{ color: 'blue', marginTop: 20 }} onPress={ openPhoneSettings }>
              Enable or disable Notifications in your phone settings.
            </Text>

            <Text style={{ color: 'blue', marginTop: 20 }} onPress={ createTestNotification }>
              Create a test notification.
            </Text>
            <Text style={{ marginLeft: 10 }}>You should see a notification appear.</Text>

            <Text style={{ color: 'blue', marginTop: 20 }} onPress={ runDailyCheck }>
              Run daily background check.
            </Text>
            <Text style={{ marginLeft: 10 }}>You should see '{FINISHED_MESSAGE}', then -- only if you have items in your feed -- you should see a new notification.</Text>
            <Text style={{ marginLeft: 20, padding: 10 }}>Note that you can force an item in your feed by decrementing the Last Notified Claim ID in Advanced Test Mode in Settings.</Text>

            <Text style={{ color: 'blue', marginTop: 20 }} onPress={ toggleToKill }>
              Terminate background check.
            </Text>
            <Text style={{ marginLeft: 20, padding: 10 }}>To test this, enable the "run forever" background code (which is only possible in development).</Text>

          </View>

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

        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
