import React, { useState } from 'react'
import { Button, SafeAreaView, ScrollView, Text, View } from 'react-native'
import QRCodeScanner from 'react-native-qrcode-scanner'
import { useFocusEffect } from '@react-navigation/native'

import { appStore } from '../veramo/appSlice'

export function ScanPresentationScreen({ navigation }) {

  const onSuccessfulQrEvent = async (e) => {
    onSuccessfulQrText(e.data)
  }

  const onSuccessfulQrText = async (claimText) => {
    navigation.navigate('Verifiable Presentation', { vp: claimText })
  }

  return (
    <SafeAreaView>
      <ScrollView>
        <View style={{ padding: 20 }}>
          <Text style={{ fontSize: 30, fontWeight: 'bold' }}>Scan</Text>
          <QRCodeScanner onRead={onSuccessfulQrEvent} />
          { appStore.getState().testMode
            ? <Button
                title='Fake It'
                onPress={() => onSuccessfulQrText('{"id":27,"issuedAt":"2021-05-03 00:03:02Z","subject":"did:ethr:0x3334FE5a696151dc4D0D03Ff3FbAa2B60568E06a","claimContext":"http://schema.org","claimType":"Person","claim":{"@context":"http://schema.org","@type":"Person","name":"Person","identifier":"did:ethr:0x3334FE5a696151dc4D0D03Ff3FbAa2B60568E06a","knowsAbout":"carpentry"}}' )}
              />
            : <View/>
          }
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

export function VerifiablePresentationScreen({ navigation, route }) {

  const { vp } = route.params

  return (
    <SafeAreaView>
      <ScrollView>
        <View style={{ padding: 20 }}>
          <Text style={{ fontSize: 30, fontWeight: 'bold' }}>Verification</Text>
          <Text>{ vp }</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
