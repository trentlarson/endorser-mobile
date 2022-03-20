import React from 'react'
import { Button, SafeAreaView, ScrollView, Text, View } from 'react-native'
import QRCodeScanner from 'react-native-qrcode-scanner'

import { appStore } from '../veramo/appSlice'
import * as utility from '../utility/utility'

export function ScanAnythingScreen({ navigation, route }) {

  const DATA_KEY = route.params.dataKey
  const NEXT_SCREEN = route.params.nextScreen
  const OTHER_DATA = route.params.otherData
  const TITLE = route.params.title

  const SAMPLE_CREDENTIAL_TEMPLATE = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    'name': 'Galactic Empire',
    'member': {
      '@type': 'OrganizationRole',
      'roleName': 'Darth Vader',
      'member': {
        '@type': 'Person',
        'identifier': utility.REPLACE_USER_DID_STRING
      }
    }
  }

  const onSuccessfulQrEvent = async (e) => {
    const nextParams = OTHER_DATA || {}
    nextParams[DATA_KEY] = e.data
    navigation.navigate(NEXT_SCREEN, nextParams)
  }

  return (
    <SafeAreaView>
      <ScrollView>
        <View style={{ padding: 20 }}>
          <Text style={{ fontSize: 30, fontWeight: 'bold' }}>{ TITLE }</Text>

          <View>
            <QRCodeScanner onRead={onSuccessfulQrEvent} />
            { appStore.getState().testMode
              ?
                <View>
                  <Button
                    title={ 'Send fake stuff to ' + NEXT_SCREEN + ' screen'}
                    onPress={() => {
                      const nextParams = {}
                      nextParams[DATA_KEY] = 'Some sample data for you. Yum!'
                      return navigation.navigate(NEXT_SCREEN, nextParams)
                    }}
                  />
                  <Button
                    title={ 'Send fake credential template'}
                    onPress={() => {
                      const nextParams = OTHER_DATA || {}
                      nextParams[DATA_KEY] = SAMPLE_CREDENTIAL_TEMPLATE
                      return navigation.navigate(NEXT_SCREEN, nextParams)
                    }}
                  />
                </View>
              :
                <View />
            }
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
