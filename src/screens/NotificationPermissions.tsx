
import notifee, { AuthorizationStatus, TriggerType } from '@notifee/react-native';
import React, { useEffect, useState } from 'react'
import { SafeAreaView, ScrollView, Text, View } from "react-native"
import BackgroundFetch from "react-native-background-fetch"
import { openSettings, requestNotifications } from 'react-native-permissions'
import { useSelector } from 'react-redux'

import { appSlice, appStore } from "../veramo/appSlice"

/**
  See test scenarios in README.md
  See flow reference: https://github.com/zoontek/react-native-permissions/blob/master/README.md#ios-flow
 **/
export function NotificationPermissionsScreen() {

  const [backgroundStatus, setBackgroundStatus] = useState<number>()
  const [canNotify, setCanNotify] = useState<boolean>()
  const [isBlocked, setIsBlocked] = useState<boolean>()
  const [openSettingsError, setOpenSettingsError] = useState<boolean>(false)

  const startupTime = useSelector((state) => state.startupTime)
  const lastBackgroundRunTime = useSelector((state) => state.lastBackgroundRunTime)

  const checkSettings = async () => {
    const storedSettings = await notifee.getNotificationSettings()
    appStore.dispatch(appSlice.actions.addLog({log: true, msg: "Notification settings: " + JSON.stringify(storedSettings)}))
    if (storedSettings.authorizationStatus === AuthorizationStatus.DENIED) {
      setCanNotify(false)
      setIsBlocked(true)
    } else if (storedSettings.authorizationStatus === AuthorizationStatus.AUTHORIZED) {
      setCanNotify(true)
    } else {
      setCanNotify(null)
    }

    setBackgroundStatus(await BackgroundFetch.status())
  }

  useEffect(() => {
    checkSettings()
  }, [])

  const enableNotifications = async () => {

    /**
    // Doesn't always work (ie. after reinstall); see https://github.com/invertase/notifee/issues/432
    // (not making high-priority notification... there's no need to display things urgently)
    const permSettings = await notifee.requestPermission({ alert: false, badge: false, carPlay: false, sound: false });
    **/

    const permSettings = await requestNotifications([])
    return checkSettings()
  }

  const openPhoneSettings = () => {
    openSettings()
    .catch(() => setOpenSettingsError(true))
  }

  return (
    <SafeAreaView>
      <ScrollView>
        <View style={{padding: 20}}>
          <Text style={{ fontSize: 30, fontWeight: 'bold' }}>Notification Permissions</Text>

          <View style={{ marginTop: 50 }} />

          <View>
            <Text>
              If you have contacts who will make commitments and build connections, or if you are interested in seeing what other people are announcing, this app can notify you. If you turn on notifications, you will get notified -- only when there is relevant information, and at most once per day.
            </Text>
            <Text>You may turn them off at any time.</Text>
          </View>

          <Text style={{ marginTop: 20 }}>Status:&nbsp;
          {
            canNotify == null
            ?
              <Text>Unsure whether you will get notifications.</Text>
            :
              canNotify == false
              ? 
                isBlocked
                ?
                  <Text>Notifications are blocked. To be notified of new activity, you must enable them in your phone settings.&nbsp;
                    <Text style={{ color: 'blue' }} onPress={ openPhoneSettings }
                    >
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

          <Text style={{ marginTop: 20 }}>Actions</Text>

          {
            !canNotify
            ?
              <Text style={{ color: 'blue', marginTop: 20 }} onPress={ enableNotifications }>
                Click here to allow this app to enable Notifications.
              </Text>
            :
              <View />
          }

          <Text style={{ color: 'blue', marginTop: 20 }} onPress={ checkSettings }>
            Click here to double-check your settings in this app.
          </Text>

          <Text style={{ color: 'blue', marginTop: 20 }} onPress={ openPhoneSettings }
          >
            Click here to enable or disable Notifications in your phone settings.
          </Text>

          {
            openSettingsError
            ? <Text style={{ color: 'red' }}>Got an error opening your phone Settings. To enable notifications manually, go to your phone 'Settings' app and then select 'Notifications' and then choose this app and turn them on.</Text>
            : <View />
          }

          <Text style={{ fontSize: 30, fontWeight: 'bold', marginTop: 50 }}>Background</Text>

          <View style={{ marginTop: 50 }} />

          <View>
            <Text>App startup time: { startupTime }</Text>
            <Text>Most recent background run: { lastBackgroundRunTime || "Never" }</Text>
            <Text>Background status:&nbsp;
            {
              backgroundStatus === BackgroundFetch.STATUS_RESTRICTED
              ?
                "Restricted"
              :
                backgroundStatus === BackgroundFetch.STATUS_DENIED
                ?
                  "Denied by user"
                :
                  backgroundStatus === BackgroundFetch.STATUS_AVAILABLE
                  ?
                    "Available"
                  :
                    "Unknown (" + backgroundStatus + ")"
            }
            </Text>
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
