import React from 'react'
import { SafeAreaView, ScrollView, Text, View } from 'react-native'
import { onboarding } from '../data/onboarding'

export function HandyContractFormScreen({ navigation }) {
  return (
    <SafeAreaView>
      <ScrollView>
        <View style={{ padding: 20 }}>
          <Text>{ onboarding.c30_mca }</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
