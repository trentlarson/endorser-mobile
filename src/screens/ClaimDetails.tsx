import React, { useState } from 'react'
import { SafeAreaView, ScrollView, Text, View } from 'react-native'
import QRCode from "react-native-qrcode-svg"

export function ClaimDetailsScreen({ navigation, route }) {

  const { fullClaim } = route.params

  return (
    <SafeAreaView>
      <ScrollView>
        <View style={{ padding: 20 }}>
          <Text style={{ fontSize: 30, fontWeight: 'bold' }}>{ fullClaim['@type'] || 'Unknown Type' }</Text>
          <View style={{ padding: 10 }}>
            <QRCode value={JSON.stringify(fullClaim)} size={300}/>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
