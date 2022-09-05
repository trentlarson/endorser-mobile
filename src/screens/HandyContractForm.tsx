import * as R from 'ramda'
import React from 'react'
import { SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native'

export function HandyContractFormScreen({ navigation, route }) {

  const { onboardingChoice } = route.params

  const title = onboardingChoice.match(/.*?\n/)[0].slice(0, -1)

  const fields = [...onboardingChoice.matchAll(/{{.*?}}/g)].flat()
  const finalFields = R.uniq(fields).map(s => s.slice(2).slice(0, -2))

  return (
    <SafeAreaView>
      <ScrollView>
        <View style={{ padding: 20 }}>
          <Text>{ title }</Text>
          <View style={{ padding: 20 }} />
          {
            finalFields.map(field =>
              <View>
                <Text>{field.replace('_', ' ')}</Text>
                <TextInput
                    key={field}
                    style={{ borderWidth: 1, marginTop: 5}}
                  />
              </View>
            )
          }
          <View style={{ padding: 20 }} />
          <Text>{ onboardingChoice }</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
