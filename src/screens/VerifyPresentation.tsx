import React from 'react'
import {
  Button,
  FlatList,
  SafeAreaView,
  ScrollView,
  Text,
  View
} from "react-native";

export function VerifyPresentationScreen({ navigation, route }) {

  const { veriPresStr } = route.params
  const veriPres = JSON.parse(veriPresStr)
  // This is an array of creds.
  const veriCreds = veriPres.verifiableCredential

  return (
    <SafeAreaView>
        <View style={{ padding: 20 }}>
          <Text style={{ fontWeight: "bold" }}>Present</Text>
          <Text>(We do not yet validate presentations.)</Text>
          <FlatList
            data={veriCreds}
            renderItem={datum =>
              <View key={""+datum.index}>
                <Button
                  title={"Check Credential " + (veriCreds.length > 1 ? datum.index + 1 : "")}
                  onPress={cred => {
                    navigation.navigate('Verify Credential', { veriCred: datum.item })
                  }}
                />
              </View>
            }
          />
        </View>
    </SafeAreaView>
  )
}
