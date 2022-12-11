//import Debug from 'debug'
import * as didJwt from 'did-jwt'
import * as R from 'ramda'
import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Button, Linking, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native'
import { CheckBox } from "react-native-elements"
import { useFocusEffect } from '@react-navigation/native';

import { Contact } from '../entity/contact'
import { PrivateData } from '../entity/privateData'
import * as utility from '../utility/utility'
import { appSlice, appStore, DEFAULT_ENDORSER_API_SERVER, DEFAULT_ENDORSER_VIEW_SERVER } from '../veramo/appSlice'
import { dbConnection } from '../veramo/setup'

// This didn't show anything in some sessions.
//const debug = Debug('endorser-mobile:sign-send--credential')

export function SignCredentialScreen({ navigation, route }) {

  const { credentialSubjects, identifier, privateFields, sendToEndorser } = route.params

  const finalCredSubjs = Array.isArray(credentialSubjects) ? credentialSubjects : [ credentialSubjects ]

  const numCreds = finalCredSubjs.length

  // return a space & claim number (1-based) for the index (0-based), or '' if there's only one
  const claimNumber = (index, upperCase) => {
    let claimText = upperCase ? 'Claim' : 'claim'
    return claimText + (numCreds === 1 ? '' : ' #' + (index+1))
  }

  const initialMessages = R.times((n) => 'Not finished with ' + claimNumber(n) + '.', numCreds)

  const [endorserIds, setEndorserIds] = useState<Array<string>>(R.times(() => null, numCreds))
  const [fetched, setFetched] = useState<Array<boolean>>(R.times(() => false, numCreds))
  const [fetching, setFetching] = useState<Array<boolean>>(R.times(() => false, numCreds))
  const [resultMessages, setResultMessages] = useState<Array<string>>(initialMessages)
  const [jwts, setJwts] = useState<Array<JWT>>(R.times(() => null, numCreds))

  const endorserViewLink = (endorserId) => {
    return appStore.getState().viewServer + '/reportClaim?claimId=' + endorserId
  }

  const setOneResultMessage = (index, message) => {
    setResultMessages(R.update(index, message))
  }

  /**
   * return promise of claim ID from Endorser server
   */
  async function sendToEndorserSite(jwt: string, index: number): Promise<string> {
    setFetching(R.update(index, true))
    appStore.dispatch(appSlice.actions.addLog({log: false, msg: "Starting the send to Endorser server..."}))
    const endorserApiServer = appStore.getState().settings.apiServer
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
      setFetched(R.update(index, true))
      appStore.dispatch(appSlice.actions.addLog({log: false, msg: "... got server status " + resp.status + "..."}))
      if (resp.ok) {
        appStore.dispatch(appSlice.actions.addLog({log: false, msg: "... finished the send to Endorser server."}))
        return resp.json()
      } else {
        const text = await resp.text()
        appStore.dispatch(appSlice.actions.addLog({log: false, msg: "... finished with error text: " + text}))
        try {
          const json = JSON.parse(text)
          const moreInfo =
            (json && json.error && json.error.message)
            || "Got failure response trying to send " + claimNumber(index) + ". " + text
          setOneResultMessage(index, moreInfo)
        } catch (e) {
          setOneResultMessage(index, "Got unexpected type of response trying to send " + claimNumber(index) + ". " + text)
        }
      }
    })
    .then(json => {
      console.log('Got Endorser server result', json)
      setEndorserIds(R.update(index, json))
      return json
    })
    .catch(err => {
      console.log('Got error sending to ' + endorserApiServer, err)
      appStore.dispatch(appSlice.actions.addLog({log: false, msg: "... but got error sending to " + endorserApiServer + " " + err}))
      setOneResultMessage(index, "Got error trying to send " + claimNumber(index) + ". The logs may tell more.")
    })
    .finally(() => {
      setFetching(R.update(index, false))
    })
  }

  /**
   * return claim ID from Endorser server, or nothing if they didn't choose to send it
   */
  async function signAndSend(credSubj, index: number): string {
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
    const vcClaim = credSubj
    const did: string = identifier.did

    appStore.dispatch(appSlice.actions.addLog({log: false, msg: "... created signer and now signing..."}))
    const alg = undefined // defaults to 'ES256K', more standardized but harder to verify vs ES256K-R
    const vcJwt: string = await didJwt.createJWT(utility.vcPayload(vcClaim),{ alg, issuer: did, signer })
    setJwts(R.update(index, vcJwt))
    setOneResultMessage(index, "Successfully signed " + claimNumber(index) + ".")
    appStore.dispatch(appSlice.actions.addLog({log: false, msg: "... created signed JWT..."}))
    if (sendToEndorser) {
      appStore.dispatch(appSlice.actions.addLog({log: false, msg: "... now sending JWT to server..."}))
      const sentResult = await sendToEndorserSite(vcJwt, index)
      appStore.dispatch(appSlice.actions.addLog({log: true, msg: "... finished the signing & sending with result: " + JSON.stringify(sentResult)} + " ..."))
      return sentResult
    } else {
      setOneResultMessage(index, "Successfully signed " + claimNumber(index) + ", but failed to send it to the server.")
      appStore.dispatch(appSlice.actions.addLog({log: false, msg: "... so we're done."}))
    }
  }

  async function saveSignSend(cred, index) {
    try {
      let privateDataId
      if (privateFields[index]) {
        const fullCred = R.clone(cred)
        fullCred.fields = privateFields[index]

        const conn = await dbConnection
        const data = new PrivateData()
        data.claimContext = cred['@context']
        data.claimType = cred['@type']
        data.claim = JSON.stringify(fullCred)
        data.did = identifier.did
        data.issuedAt = Math.round(new Date().valueOf() / 1000)
        if (utility.isContract(cred)) {
          data.contractFormIpfsCid = cred.contractFormIpfsCid,
          data.contractFullMdHash = cred.contractFullMdHash
        } else if (utility.isContractAccept(cred)) {
          data.contractFormIpfsCid = cred.object.contractFormIpfsCid,
          data.contractFullMdHash = cred.object.contractFullMdHash
        }
        const saved = await conn.manager.insert(PrivateData, data)
        privateDataId = saved.raw
      }

      const sentResult = await signAndSend(cred, index)

      if (sentResult && privateDataId) {
        const conn = await dbConnection
        let host = appStore.getState().settings.apiServer
        if (host.startsWith('https://')) {
          host = host.substring('https://'.length)
        } else if (host.startsWith('http://')) {
          host = host.substring('http://'.length)
        }
        const saveResult = await conn.manager.update(
          PrivateData,
          privateDataId,
          {
            serverHost: host,
            serverId: sentResult,
            serverUrl: appStore.getState().settings.apiServer + '/api/claim/' + sentResult,
          }
        )
      }

      if (sentResult) {
        setOneResultMessage(index, "Successfully signed " + claimNumber(index) + " and sent it to the server.")
        appStore.dispatch(appSlice.actions.addLog({log: false, msg: "... finished storing server data locally."}))
        return sentResult
      } else {
        setOneResultMessage(index, "Successfully signed " + claimNumber(index) + " but did not record any server result.")
      }

    } catch (e) {
      setOneResultMessage(index, "Something failed in the signing or sending of " + claimNumber(index) + ".")
      appStore.dispatch(appSlice.actions.addLog({log: true, msg: "Got error in SignSendToEndorser.signAndSend: " + e}))

      // I have seen cases where each of these give different, helpful info.
      console.log('Error storing / signing / sending claim, 1:', e)
      console.log('Error storing / signing / sending claim, 2: ' + e)
      console.log('Error storing / signing / sending claim, 3:', e.toString())
    }
  }

  useFocusEffect(
    React.useCallback(() => {
      const doActions = async () => {
        return finalCredSubjs.map((cred, index) => saveSignSend(cred, index))
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
                  (appStore.getState().settings.apiServer !== DEFAULT_ENDORSER_API_SERVER
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
                              <Text>Endorser ID</Text>
                              <Text style={{ textAlign: "center" }} selectable={true}>{ endorserIds[index] }</Text>
                              <Button
                                title="Success!"
                                onPress={() => {
                                  Linking.openURL(endorserViewLink(endorserIds[index])).catch(err => {
                                    setOneResultMessage(index, 'Sorry, something went wrong trying to let you browse the record on the Endorser server. ' + err)
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
                            <Text>Data is not saved on the Endorser server.</Text>
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
                      <Text style={{ fontSize: 20 }}>{ claimNumber(index, true) }</Text>

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

                      <View>
                        <View style={{ marginTop: 10 }} />
                        <Text>JWT with Signature</Text>
                        <TextInput
                          editable={false}
                          multiline={true}
                          style={{ borderWidth: 1, height: 300 }}
                        >
                          { jwts[index] }
                        </TextInput>
                      </View>

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
