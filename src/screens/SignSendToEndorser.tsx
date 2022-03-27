import Debug from 'debug'
import * as didJwt from 'did-jwt'
import * as R from 'ramda'
import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Button, Linking, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native'
import { CheckBox } from "react-native-elements"
import { useFocusEffect } from '@react-navigation/native';

import * as utility from '../utility/utility'
import { appSlice, appStore, DEFAULT_ENDORSER_API_SERVER, DEFAULT_ENDORSER_VIEW_SERVER } from '../veramo/appSlice'
import { agent, dbConnection } from '../veramo/setup'

const debug = Debug('endorser-mobile:sign-send--credential')

export function SignCredentialScreen({ navigation, route }) {

  let { credentialSubjects, sendToEndorser, identifier } = route.params

  const messages = R.times((n) => 'Did not work with claim #' + (n + 1) + '.', credentialSubjects.length)
  messages[0] = ''

  const [endorserId, setEndorserId] = useState<string>(null)
  const [fetched, setFetched] = useState<boolean>(false)
  const [fetching, setFetching] = useState<boolean>(false)
  const [resultMessages, setResultMessages] = useState<Array<string>>(messages)
  const [jwt, setJwt] = useState<JWT>()

  const endorserViewLink = (endorserId) => {
    return appStore.getState().viewServer + '/reportClaim?claimId=' + endorserId
  }

  /**
   * return promise of claim ID from Endorser server
   */
  async function sendToEndorserSite(jwt: string): Promise<string> {
    setFetching(true)
    appStore.dispatch(appSlice.actions.addLog({log: false, msg: "Starting the send to Endorser server..."}))
    const endorserApiServer = appStore.getState().apiServer
    const token = await utility.accessToken(identifier)
    appStore.dispatch(appSlice.actions.addLog({log: false, msg: "... sending to server..."}))
    return fetch(endorserApiServer + '/api/claim', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Uport-Push-Token': token,
      },
      body: JSON.stringify({ jwtEncoded: jwt }),
    })
    .then(async resp => {
      appStore.dispatch(appSlice.actions.addLog({log: false, msg: "... got server response..."}))
      setFetching(false)
      setFetched(true)
      debug('Got endorser.ch status', resp.status)
      appStore.dispatch(appSlice.actions.addLog({log: false, msg: "... got server status " + resp.status + "..."}))
      if (resp.ok) {
        appStore.dispatch(appSlice.actions.addLog({log: false, msg: "... finished the send to Endorser server."}))
        return resp.json()
      } else {
        const text = await resp.text()
        appStore.dispatch(appSlice.actions.addLog({log: false, msg: "... finished with error text: " + text}))
        throw Error('Got failure response code of ' + resp.status + ' with body text of ' + text)
      }
    })
    .then(json => {
      debug('Got endorser.ch result', json)
      setEndorserId(json)
      return json
    })
    .catch(err => {
      debug('Got error sending to ' + endorserApiServer, err)
      throw Error(
        'Sorry, got a problem with the response from ' + endorserApiServer + ' ' + err,
      )
    })
    .finally(() => {
      setFetching(false)
    })

  }

  /**
   * return claim ID from Endorser server, or nothing if they didn't choose to send it
   */
  async function signAndSend(credSubj, index): string {
    try {
      /**
      // would like to use https://www.npmjs.com/package/did-jwt-vc
      // but: "TypeError: Object is not a constructor (evaluating 'new EthrDID')"
      const issuer: Issuer = new EthrDID({
        address: '0xf1232f840f3ad7d23fcdaa84d6c66dac24efb198',
        privateKey: 'd8b595680851765f38ea5405129244ba3cbad84467d190859f4c8b20c1ff6c75'
      })
      const vcJwt: JWT = await createVerifiableCredentialJwt(vcPayload, issuer)
      **/

      appStore.dispatch(appSlice.actions.addLog({log: false, msg: "Starting the signing & sending..."}))
      const signer = didJwt.SimpleSigner(identifier.keys[0].privateKeyHex)
      const did: string = identifier.did
      const vcClaim = credSubj
      appStore.dispatch(appSlice.actions.addLog({log: false, msg: "... created signer and now signing..."}))
      const vcJwt: string = await didJwt.createJWT(utility.vcPayload(did, vcClaim),{ issuer: did, signer })
      setJwt(vcJwt)
      setResultMessages(R.update(index, "Successfully signed claim #" + (index + 1) + ".", resultMessages))
      appStore.dispatch(appSlice.actions.addLog({log: false, msg: "... created signed JWT..."}))
      if (sendToEndorser) {
        appStore.dispatch(appSlice.actions.addLog({log: false, msg: "... now sending JWT to server..."}))
        let result = await sendToEndorserSite(vcJwt)
        setResultMessages(R.update(index, "Successfully signed claim #" + (index + 1) + " and sent it to the server.", resultMessages))
        appStore.dispatch(appSlice.actions.addLog({log: false, msg: "... finished the signing & sending with result: " + JSON.stringify(result)}))
        return result
      } else {
        setResultMessages(R.update(index, "Successfully signed claim #" + (index + 1) + ", but failed to send it to the server.", resultMessages))
        appStore.dispatch(appSlice.actions.addLog({log: false, msg: "... so we're done."}))
      }
    } catch (e) {
      setResultMessages(R.update(index, resultMessages[index] + " Something failed in the signing or sending of claim #" + (index + 1) + ".", resultMessages))
      appStore.dispatch(appSlice.actions.addLog({log: true, msg: "Got error in SignSendToEndorser.signAndSend: " + e}))

      // I have seen cases where each of these give different, helpful info.
      console.log('Error signing & sending claim, 1:', e)
      console.log('Error signing & sending claim, 2: ' + e)
      console.log('Error signing & sending claim, 3:', e.toString())
      throw e
    }
  }

  useFocusEffect(
    React.useCallback(() => {
      const doActions = async () => {
        signAndSend(credentialSubjects[0], 0)
      }
      doActions()
    }, [credentialSubjects])
  )

  return (
    <SafeAreaView>
      <ScrollView>
        <View style={{ padding: 20 }}>
          { identifier ? (
            <View>
              <Text style={{ fontSize: 30, fontWeight: 'bold', marginBottom: 10 }}>
                Sign
                {
                  (appStore.getState().apiServer !== DEFAULT_ENDORSER_API_SERVER
                   || appStore.getState().viewServer !== DEFAULT_ENDORSER_VIEW_SERVER)
                   ? " - Custom Servers"
                   : ""
                }
              </Text>

              <View>
                {
                  resultMessages.map((message, index) => (
                    <Text key={ index }>{ message }</Text>
                  ))
                }
              </View>

              <View style={{ marginTop: 20 }} />
              <Text>{jwt ? "The credential is signed." : ""} </Text>
              <View>
                {
                  fetched ? (
                    endorserId ? (
                      <Button
                        title="Success!  Click here to see your claim on the Endorser server -- but note that you won't see all the info if you're not logged in."
                        onPress={() => {
                          Linking.openURL(endorserViewLink(endorserId)).catch(err => {
                            throw Error(
                              'Sorry, something went wrong trying to let you browse the record on the Endorser server. ' + err,
                            )
                          })
                        }}
                      />
                    ) : ( /* fetched && !endorserId */
                      <Text>Got response from the Endorser server but something went wrong.  You might check your data.  If it's good, there may be an error at Endorser.</Text>
                    )
                  ) : ( /* !fetched */
                    fetching ? (
                      <View>
                        <Text>Saving to the Endorser server...</Text>
                        <ActivityIndicator size="large" color="#00ff00" />
                      </View>
                    ) : ( /* !fetched && !fetching */
                      <Text>Something went very wrong.</Text>
                    )
                  )
                }

                <View>

                  {
                    jwt ? (
                      <View>
                        <View style={{ marginTop: 50 }} />
                        <Text>JWT</Text>
                        <TextInput
                          multiline={true}
                          style={{ borderWidth: 1, height: 300 }}
                        >
                          { jwt }
                        </TextInput>
                      </View>
                    ) : ( /* !jwt */
                      <Text/>
                    )
                  }

                  <Text style={{ marginTop: 75, marginBottom: 5 }}>Details</Text>
                  <Text style={{ fontSize: 11 }}>Signed As:</Text>
                  <Text style={{ fontSize: 11 }}>{identifier.did}</Text>

                  <TextInput
                    editable={false}
                    multiline={true}
                    style={{ borderWidth: 1, height: 300 }}
                  >
                    { JSON.stringify(credentialSubjects, null, 2) }
                  </TextInput>
                </View>
              </View>
            </View>
          ) : (
            <Text>You must create an identifier (under Settings).</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
