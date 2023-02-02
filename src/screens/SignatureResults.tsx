import React from 'react'
import { Button, SafeAreaView, ScrollView, Text, View } from 'react-native'

import { appSlice, appStore } from '../veramo/appSlice'
import * as utility from '../utility/utility'

export function SignatureResultsScreen({ navigation, route }) {

  const results: utility.SignedSentResults = route.params?.results

  const endorserViewLink = (endorserId) => {
    return appStore.getState().viewServer + '/reportClaim?claimId=' + endorserId
  }

  return (
    <SafeAreaView>
      <ScrollView>
        <View style={{ padding: 20 }}>
          {
            results.map((result, index) => (
              <View style={{ height: 75 }} key={ index }>
                <Text>{ result.message }</Text>
                {
                  result.serverId ? (
                    <View>
                        <Text>Endorser ID</Text>
                        <Text style={{ textAlign: "center" }} selectable={true}>{ result.serverId }</Text>
                        <Button
                          title="View on Server"
                          onPress={() => {
                            Linking.openURL(endorserViewLink(result.serverId)).catch(err => {
                              appStore.dispatch(appSlice.actions.addLog({
                                log: true,
                                msg: "Error trying to redirect to Endorser server: " + err
                              }))
                              Alert.alert('Got an error showing the Endorser server record. See the logs.')
                            })
                          }}
                        />
                    </View>
                  ) : ( /* !serverId */
                      <Text>Data is not saved on the Endorser server.</Text>
                  )
                }
              </View>
            ))
          }
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
