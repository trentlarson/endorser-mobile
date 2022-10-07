import * as R from 'ramda'
import React from 'react'
import { Button, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native'
import { CheckBox } from "react-native-elements"

import * as utility from '../utility/utility'

export function ContractFormScreen({ navigation, route }) {

  const { nextScreen, onboardingChoice, privateFields } = route.params

  const [data, setData] = React.useState(privateFields || {});
  const [accept, setAccept] = React.useState<boolean>(true);

  if (!onboardingChoice) {
    return (
      <SafeAreaView>
        <ScrollView>
          <View style={{ padding: 20 }}>
            <Text>That contract is not recognized. Please review the information with the source and try again.</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    )
  }

  const contractText = onboardingChoice.templateText
  const titleLine = contractText.match(/.*?\n/)[0].slice(0, -1)
  const title = titleLine.replace(/#*/, '').replace(/ */, '')

  // documentation implies that matches happen in order of appearance in the text
  const fields = [...contractText.matchAll(/{{.*?}}/g)].flat()
  const finalFields = R.uniq(fields).map(s => s.slice(2).slice(0, -2))

  return (
    <SafeAreaView>
      <ScrollView>
        <View style={{ padding: 20 }}>
          <Text>{ title }</Text>
          <View style={{ padding: 20 }} />
          {
            finalFields.map(field =>
              <View key={field}>
                <Text>{field.replace(/_/g, ' ')}</Text>
                <TextInput
                  multiline={true}
                  onChangeText={text => setData(R.set(R.lensProp(field), text, data))}
                  style={{ borderWidth: 1, marginTop: 5}}
                  value={data[field]}
                />
              </View>
            )
          }
          <CheckBox
            title='Accept Contract Terms'
            checked={accept}
            onPress={() => {setAccept(!accept)}}
          />
          <Button
            title="Sign"
            onPress={() => navigation.navigate(
              nextScreen,
              {
                credentialSubject: utility.constructContract(onboardingChoice.templateIpfsCid, data),
                acceptContract: accept
              }
            )}
          />
          <View style={{ padding: 20 }} />
          <Text>{ contractText }</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
