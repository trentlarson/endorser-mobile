import * as didJwt from 'did-jwt'
import React, { useState } from 'react'
import { ActivityIndicator, Alert, Button, Modal, SafeAreaView, ScrollView, StyleSheet, Text, TouchableHighlight, View } from 'react-native'
import { CheckBox } from 'react-native-elements'
import QRCodeScanner from 'react-native-qrcode-scanner'
import { useFocusEffect } from '@react-navigation/native'
import { useSelector } from 'react-redux'

import { styles } from './style'
import { Contact } from '../entity/contact'
import { appSlice, appStore } from '../veramo/appSlice'
import { agent, dbConnection } from '../veramo/setup'
import * as utility from '../utility/utility'

export function ContactImportScreen({ navigation }) {

  const CURRENT_JWT_PREFIX = appStore.getState().viewServer + utility.ENDORSER_JWT_URL_LOCATION

  const identifiers = useSelector((state) => state.identifiers || [])

  const onSuccessfulQrEvent = async (e) => {
    navigation.navigate('Contacts', { scannedDatum: e.data })
  }

  return (
    <SafeAreaView>
      <ScrollView>
        <View style={{ padding: 20 }}>
          <Text style={{ fontSize: 30, fontWeight: 'bold' }}>Import Contact</Text>

          <View>
            <QRCodeScanner onRead={onSuccessfulQrEvent} />
            { appStore.getState().testMode
              ?
                <View>
                  <Button
                    title='Fake Singleton'
                    onPress={() => navigation.navigate('Contacts', { scannedDatum: CURRENT_JWT_PREFIX + "eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NksifQ.eyJpYXQiOjE2MTUyNjMwODc3OTMsImlzcyI6ImRpZDpldGhyOjB4M2YyMDVFMTgwOGU4NWVDREFmYTU0MGYyZEE1N0JkQzhkOWQyZDUxRCIsIm93biI6eyJuYW1lIjoiU3R1ZmYiLCJwdWJsaWNFbmNLZXkiOiJnM1oxbUpzSDlzRVVXM1ZremtXb2tZenlKRUdGUUFidG9QcnFqT0s3RWs0PSJ9fQ.h27enm55_0Bd06UJHAQWRmULwidOOhHNe2reqjYTAcVJvQ0aUTCEmP88HlJcZ3bUa-VbrXT76sqV6i19bQZ_PA" })}
                  />
                  <Button
                    title='Fake Singleton Too'
                    onPress={() => navigation.navigate('Contacts', { scannedDatum: CURRENT_JWT_PREFIX + "eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NksifQ.eyJpYXQiOjE2MTUyNjMwODc3OTMsImlzcyI6ImRpZDpldGhyOjB4N3ZyMDVFMTgwOGU4NWVDREFmYTU0MGYyZEE1N0JkQzhkOWQyZDUxRCIsIm93biI6eyJuYW1lIjoiN3R1ZmYiLCJwdWJsaWNFbmNLZXkiOiJNN1oxbUpzSDlzRVVXM1ZremtXb2tZenlKRUdGUUFidG9QcnFqT0s3RWs0PSJ9fQ.h27enm55_0Bd06UJHAQWRmULwidOOhHNe2reqjYTAcVJvQ0aUTCEmP88HlJcZ3bUa-VbrXT76sqV6i19bQZ_PA" })}
                  />
                  <Button
                    title='Fake 127.0.0.1:8080/test.csv'
                    onPress={() => navigation.navigate('Contacts', { scannedDatum: "http://127.0.0.1:8080/test.csv" })}
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
