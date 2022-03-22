import React from 'react'
import { Button, SafeAreaView, ScrollView, Text, View } from 'react-native'
import QRCodeScanner from 'react-native-qrcode-scanner'

import { appStore } from '../veramo/appSlice'
import * as utility from '../utility/utility'

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
const SAMPLE_CREDENTIAL_TEMPLATE_STRING = JSON.stringify(SAMPLE_CREDENTIAL_TEMPLATE)




export function ScanAnythingScreen({ navigation, route }) {

  const nextScreen = route.params.nextScreen
  const paramsCreator = route.params.paramsCreator || (scanned => JSON.parse(scanned))
  const title = route.params.title

  const onSuccessfulQrEvent = async (e) => {
    const nextParams = otherData || {}
    nextParams[dataKey] = e.data
    navigation.navigate(nextScreen, nextParams)
  }

  return (
    <SafeAreaView>
      <ScrollView>
        <View style={{ padding: 20 }}>
          <Text style={{ fontSize: 30, fontWeight: 'bold' }}>{ title }</Text>

          <View>
            <QRCodeScanner onRead={onSuccessfulQrEvent} />
            { appStore.getState().testMode
              ?
                <View>
                  <Button
                    title={ 'Send fake stuff to ' + nextScreen + ' screen'}
                    onPress={() => {
                      return navigation.navigate(nextScreen, paramsCreator('"Some sample data for you. Yum!"'))
                    }}
                  />
                  <Button
                    title={ 'Send fake credential template to ' + nextScreen + ' screen'}
                    onPress={() => {
                      return navigation.navigate(nextScreen, paramsCreator(SAMPLE_CREDENTIAL_TEMPLATE_STRING))
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
