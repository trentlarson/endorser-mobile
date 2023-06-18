import React, { useState } from 'react'
import { Button, Linking, Modal, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native'
import Clipboard from '@react-native-community/clipboard'

import { styles } from '../screens/style'
import { appSlice, appStore, DEFAULT_ENDORSER_API_SERVER } from '../veramo/appSlice'
import * as utility from '../utility/utility'
import { YamlFormat } from '../utility/utility.tsx'

export function SignatureResultsScreen({ navigation, route }) {

  const results: utility.SignedSentResults = route.params?.results

  const [quickMessage, setQuickMessage] = useState<string>('')

  const endorserViewLink = (endorserId) => {
    return appStore.getState().viewServer + '/reportClaim?claimId=' + endorserId
  }

  const copyToClipboard = (text) => {
    Clipboard.setString(text)
    setQuickMessage('Copied')
    setTimeout(() => setQuickMessage(''), 1000)
  }

  return (
    <SafeAreaView>
      <ScrollView>
        <View style={{ padding: 20 }}>
          <Text>
            {
              (appStore.getState().settings.apiServer !== DEFAULT_ENDORSER_API_SERVER)
              ? "Custom Servers"
              : ""
            }
          </Text>
          {
            results.map((result, index) => (
              <View style={{ marginTop: 10 }} key={ index }>
                <Text>{ result.message }</Text>
                {
                  result.serverId ? (
                    <View>
                        <Text>Endorser.ch ID:</Text>
                        <Text style={{ textAlign: "center" }} selectable={true}>
                          { result.serverId }
                        </Text>
                        <Text
                          style={{ color: 'blue', textAlign: "right" }}
                          onPress={() => {
                            Linking.openURL(endorserViewLink(result.serverId))
                            .catch(err => {
                              appStore.dispatch(appSlice.actions.addLog({
                                log: true,
                                msg: "Error trying to redirect to Endorser server: " + err
                              }))
                              Alert.alert('Got an error showing the Endorser server record. See the logs.')
                            })
                          }}
                        >
                          Visit Server URL
                        </Text>
                    </View>
                  ) : ( /* !result.serverId */
                    <Text>Data is not saved on the Endorser server.</Text>
                  )
                }
              </View>
            ))
          }
        </View>

        <View>
          {
            results.map((result, index) => (
              <View style={{ marginTop: 30 }} key={index}>

                <Text style={{ fontWeight: 'bold' }}>Details</Text>

                <View>
                  <View style={{ marginTop: 10 }} />
                  <Text
                    style={{ color: 'blue' }}
                    onPress={() => copyToClipboard(result.jwt) }
                  >
                    Copy to Clipboard the Signed Verifiable Credential JWT
                  </Text>
                </View>

                <Text style={{ marginTop: 10, marginBottom: 5 }}>
                  { utility.claimNumberText(index, results.length, true) }:
                </Text>
                <YamlFormat source={ result.credential } />

              </View>
            ))
          }
        </View>

        <Modal
          animationType="slide"
          transparent={true}
          visible={!!quickMessage}
        >
          <View style={styles.centeredView}>
            <View style={styles.modalView}>
               <Text>{ quickMessage }</Text>
            </View>
          </View>
        </Modal>

      </ScrollView>
    </SafeAreaView>
  )
}
