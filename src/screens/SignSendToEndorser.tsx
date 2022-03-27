import Debug from 'debug'
import * as didJwt from 'did-jwt'
import * as R from 'ramda'
import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Button, Linking, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native'
import { CheckBox } from "react-native-elements"
import { useFocusEffect } from '@react-navigation/native';

import * as utility from '../utility/utility'
import { appSlice, appStore, DEFAULT_ENDORSER_API_SERVER, DEFAULT_ENDORSER_VIEW_SERVER } from '../veramo/appSlice'

const debug = Debug('endorser-mobile:sign-send--credential')

export function SignCredentialScreen({ navigation, route }) {

  let { credentialSubjects, sendToEndorser, identifier } = route.params

  let finalCredSubjs = Array.isArray(credentialSubjects) ? credentialSubjects : [ credentialSubjects ]

  let numCreds = finalCredSubjs.length
  let initialMessages = R.times((n) => 'Not finished with claim #' + (n+1) + '.', numCreds)

  const [endorserIds, setEndorserIds] = useState<Array<string>>(R.times(() => null, numCreds))
  const [fetched, setFetched] = useState<Array<boolean>>(R.times(() => false, numCreds))
  const [fetching, setFetching] = useState<Array<boolean>>(R.times(() => false, numCreds))
  const [resultMessages, setResultMessages] = useState<Array<string>>(initialMessages)
  const [jwts, setJwts] = useState<Array<JWT>>(R.times(() => null, numCreds))

  const endorserViewLink = (endorserId) => {
    return appStore.getState().viewServer + '/reportClaim?claimId=' + endorserId
  }

  /**
   * return promise of claim ID from Endorser server
   */
  async function sendToEndorserSite(jwt: string, index: number): Promise<string> {
    setFetching(R.update(index, true))
    appStore.dispatch(appSlice.actions.addLog({log: false, msg: "Starting the send to Endorser server..."}))
    const endorserApiServer = appStore.getState().apiServer
    const token = await utility.accessToken(identifier)
    appStore.dispatch(appSlice.actions.addLog({log: false, msg: "... sending to server..."}))
    fetch(endorserApiServer + '/api/claim', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Uport-Push-Token': token,
      },
      body: JSON.stringify({ jwtEncoded: jwt }),
    })
    .then(async resp => {
      appStore.dispatch(appSlice.actions.addLog({log: false, msg: "... got server response..."}))
      setFetched(R.update(index, true))
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
      setEndorserIds(R.update(index, json))
      return json
    })
    .catch(err => {
      debug('Got error sending to ' + endorserApiServer, err)
      throw Error(
        'Sorry, got a problem with the response from ' + endorserApiServer + ' ' + err,
      )
    })
    .finally(() => {
      setFetching(R.update(index, false))
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
      setJwts(R.update(index, vcJwt))
      setResultMessages(R.update(index, "Successfully signed claim #" + (index+1) + "."))
      appStore.dispatch(appSlice.actions.addLog({log: false, msg: "... created signed JWT..."}))
      if (sendToEndorser) {
        appStore.dispatch(appSlice.actions.addLog({log: false, msg: "... now sending JWT to server..."}))
        let result = await sendToEndorserSite(vcJwt, index)
        setResultMessages(R.update(index, "Successfully signed claim #" + (index+1) + " and sent it to the server."))
        appStore.dispatch(appSlice.actions.addLog({log: false, msg: "... finished the signing & sending with result: " + JSON.stringify(result)}))
        return result
      } else {
        setResultMessages(R.update(index, "Successfully signed claim #" + (index+1) + ", but failed to send it to the server."))
        appStore.dispatch(appSlice.actions.addLog({log: false, msg: "... so we're done."}))
      }
    } catch (e) {
      setResultMessages(R.update(index, resultMessages[index] + " Something failed in the signing or sending of claim #" + (index+1) + "."))
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
        return finalCredSubjs.map((cred, index) => signAndSend(cred, index))
      }
      doActions()
    }, [finalCredSubjs])
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
                    <View style={{ height: 75 }} key={ index }>
                      <Text>{ message }</Text>

                      {
                        fetched[index] ? (
                          endorserIds[index] ? (
                            <View>
                              <Text>Endorser ID { endorserIds[index] }</Text>
                              <Button
                                title="Success!"
                                onPress={() => {
                                  Linking.openURL(endorserViewLink(endorserIds[index])).catch(err => {
                                    throw Error(
                                      'Sorry, something went wrong trying to let you browse the record on the Endorser server. ' + err,
                                    )
                                  })
                                }}
                              />
                            </View>
                          ) : ( /* fetched && !endorserId */
                            <Text>Got response from the Endorser server but something went wrong.  You might check your data.  If it's good, there may be an error at Endorser.</Text>
                          )
                        ) : ( /* !fetched */
                          fetching[index] ? (
                            <View>
                              <ActivityIndicator size="large" color="#00ff00" />
                              <Text>Saving to the Endorser server...</Text>
                            </View>
                          ) : ( /* !fetched && !fetching */
                            <Text>Something went very wrong.</Text>
                          )
                        )
                      }

                    </View>
                  ))
                }
              </View>

              <View style={{ marginTop: 20 }} />
              <View>

                {
                  finalCredSubjs.map((origCred, index) => (
                    <View style={{ marginTop: 30 }} key={index}>
                      <Text style={{ fontSize: 20 }}>Claim #{index+1}</Text>

                      {
                        jwts[index] ? (
                          <View>
                            <View style={{ marginTop: 10 }} />
                            <Text>JWT with Signature</Text>
                            <TextInput
                              multiline={true}
                              style={{ borderWidth: 1, height: 300 }}
                            >
                              { jwts[index] }
                            </TextInput>
                          </View>
                        ) : ( /* !jwt */
                          <Text>There is no signature for this credential.</Text>
                        )
                      }

                      <Text style={{ marginTop: 10, marginBottom: 5 }}>Original Details</Text>
                      <Text style={{ fontSize: 11 }}>Signed As:</Text>
                      <Text style={{ fontSize: 11 }}>{identifier.did}</Text>

                      <TextInput
                        editable={false}
                        multiline={true}
                        style={{ borderWidth: 1, height: 300 }}
                      >
                        { JSON.stringify(origCred, null, 2) }
                      </TextInput>
                    </View>
                  ))
                }
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
