import React from 'react'
import { Button, SafeAreaView, ScrollView, Text, View } from 'react-native'
import QRCodeScanner from 'react-native-qrcode-scanner'
import QRCode from "react-native-qrcode-svg"

import { appStore } from '../veramo/appSlice'
import * as utility from '../utility/utility'

const SAMPLE_CREDENTIAL_TEMPLATE = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Galactic Empire",
  "member": {
    "@type": "OrganizationRole",
    "roleName": "Darth Vader",
    "member": {
      "@type": "Person",
      "identifier": utility.REPLACE_USER_DID_STRING
    }
  }
}
const SAMPLE_MULTIPLE_CREDENTIALS = [
  SAMPLE_CREDENTIAL_TEMPLATE,
  {
    "@context": "https://schema.org",
    "@type": "Person",
    identifier: utility.REPLACE_USER_DID_STRING,
    knowsAbout: "gardening"
  }
]




export function ScanAnythingScreen({ navigation, route }) {

  const nextData = route.params.nextData || {}
  const nextScreen = route.params.nextScreen
  const title = route.params.title

  const onSuccessfulQrEvent = async (e) => {
    nextData.scannedText = e.data
    navigation.navigate(nextScreen, nextData)
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
                    title={ 'Send random text to ' + nextScreen + ' screen'}
                    onPress={() => {
                      nextData.scannedText = '"Some sample data for you. Yum!"'
                      return navigation.navigate(nextScreen, nextData)
                    }}
                  />
                  <Button
                    title={ 'Send test cred template to ' + nextScreen + ' screen'}
                    onPress={() => {
                      nextData.scannedText = JSON.stringify(SAMPLE_CREDENTIAL_TEMPLATE)
                      return navigation.navigate(nextScreen, nextData)
                    }}
                  />
                  <Button
                    title={ 'Send list of cred templates to ' + nextScreen + ' screen'}
                    onPress={() => {
                      nextData.scannedText = JSON.stringify(SAMPLE_MULTIPLE_CREDENTIALS)
                      return navigation.navigate(nextScreen, nextData)
                    }}
                  />
                  <QRCode value={JSON.stringify(SAMPLE_MULTIPLE_CREDENTIALS)} size={300} />
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
