//import Debug from 'debug'
import * as didJwt from 'did-jwt'
import * as R from 'ramda'
import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Linking, SafeAreaView, ScrollView, Text, View } from 'react-native'
import { useFocusEffect } from '@react-navigation/native';

import { PrivateData } from '../entity/privateData'
import * as utility from '../utility/utility'
import { appSlice, appStore, DEFAULT_ENDORSER_API_SERVER } from '../veramo/appSlice'
import { dbConnection } from '../veramo/setup'

// This didn't show anything in some sessions.
//const debug = Debug('endorser-mobile:sign-send--credential')

export function SignCredentialScreen({ navigation, route }) {

  const { credentialSubjects, identifier, privateFields, sendToEndorser } = route.params

  const finalCredSubjs = Array.isArray(credentialSubjects) ? credentialSubjects : [ credentialSubjects ]

  const numCreds = finalCredSubjs.length

  const initialMessages = R.times((n) => 'Not finished with ' + utility.claimNumberText(n, numCreds) + '.', numCreds)

  const [endorserIds, setEndorserIds] = useState<Array<string>>(R.times(() => null, numCreds))
  const [fetched, setFetched] = useState<Array<boolean>>(R.times(() => false, numCreds))
  const [fetching, setFetching] = useState<Array<boolean>>(R.times(() => false, numCreds))
  const [resultMessages, setResultMessages] = useState<Array<string>>(initialMessages)
  const [jwts, setJwts] = useState<Array<JWT>>(R.times(() => null, numCreds))

  const endorserViewLink = (endorserId) => {
    return appStore.getState().viewServer + '/reportClaim?claimId=' + endorserId
  }

  // Set the message for this index in the result-messages array
  const setOneResultMessage = (index, message) => {
    setResultMessages(R.update(index, message))
  }

  /**
   * return promise of claim ID from Endorser server, or undefined if there is no ID
   */
  async function sendToEndorserSite(jwt: string, index: number): Promise<string> {
    setFetching(R.update(index, true))
    appStore.dispatch(appSlice.actions.addLog({log: true, msg: "Starting send to Endorser server..."}))
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
        appStore.dispatch(appSlice.actions.addLog({log: true, msg: "... finished sending to Endorser server."}))
        const json = await resp.json()
        return { serverId: json }
      } else {
        const text = await resp.text()
        appStore.dispatch(appSlice.actions.addLog({log: true, msg: "... finished with error text: " + text}))
        let resultMessage
        try {
          const json = JSON.parse(text)
          const moreInfo =
            (json && json.error && json.error.message)
            || "Got failure response trying to send " + utility.claimNumberText(index, numCreds) + ". " + text
          resultMessage = moreInfo
          setOneResultMessage(index, moreInfo)
        } catch (e) {
          resultMessage =
            "Got unexpected type of response trying to send " + utility.claimNumberText(index, numCreds) + ". " + text
          setOneResultMessage(index, resultMessage)
        }
        return { message: resultMessage } // to signal no good ID
      }
    })
    .then(resultJson => {
      setEndorserIds(R.update(index, resultJson.serverId))
      return resultJson
    })
    .catch(err => {
      appStore.dispatch(appSlice.actions.addLog({
        log: false,
        msg: "... but got error sending to " + endorserApiServer + " " + err
      }))
      const resultMessage =
        "Got error trying to send " + utility.claimNumberText(index, numCreds)
        + ". The logs (near the bottom of Help) may tell more."
      setOneResultMessage(index, resultMessage)
      return { message: resultMessage }
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
    let resultMessage = "Successfully signed " + utility.claimNumberText(index, numCreds) + "."
    setOneResultMessage(index, resultMessage)
    appStore.dispatch(appSlice.actions.addLog({log: false, msg: "... created signed JWT..."}))
    if (sendToEndorser) {
      appStore.dispatch(appSlice.actions.addLog({log: false, msg: "... now sending JWT to server..."}))
      const sentResult = await sendToEndorserSite(vcJwt, index)
      appStore.dispatch(appSlice.actions.addLog({
        log: false,
        msg: "... finished the signing & sending with result: " + JSON.stringify(sentResult) + "..."
      }))
      sentResult.credential = credSubj
      sentResult.jwt = vcJwt
      if (!sentResult.message) {
        sentResult.message = resultMessage
      }
      return sentResult
    } else {
      const partialResultMessage =
        "Successfully signed " + utility.claimNumberText(index, numCreds) + ". Did not share it to any server."
      setOneResultMessage(index, partialResultMessage)
      appStore.dispatch(appSlice.actions.addLog({log: false, msg: "... so we're done."}))
      return { credential: credSubj, message: partialResultMessage, jwt: vcJwt }
    }
  }

  async function saveSignSend(cred, index): utility.SignedSentResults {
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

      if (sentResult.serverId && privateDataId) {
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
            serverId: sentResult.serverId,
            serverUrl:
              appStore.getState().settings.apiServer + '/api/claim/' + sentResult.serverId,
          }
        )
      }

      if (sentResult.serverId) {
        const resultMessage =
          "Successfully signed " + utility.claimNumberText(index, numCreds) + " and sent it to the server."
        setOneResultMessage(index, resultMessage)
        appStore.dispatch(appSlice.actions.addLog({
          log: true,
          msg: "Signed, and finished storing data remotely & locally. Server result: " + JSON.stringify(sentResult)
        }))
        sentResult.message = resultMessage
      } else {
        // expect that some result message is already set
        appStore.dispatch(appSlice.actions.addLog({
          log: true,
          // sentResult can be undefined for errors
          msg: "Signed, and finished storing data locally. Server result: " + JSON.stringify(sentResult)
        }))

      }
      return sentResult

    } catch (e) {
      const resultMessage =
        "Something failed in the signing or sending of " + utility.claimNumberText(index, numCreds) + "."
      setOneResultMessage(index, resultMessage)
      appStore.dispatch(appSlice.actions.addLog({log: true, msg: "Got error in SignSendToEndorser.signAndSend: " + e}))

      // I have seen cases where each of these give different, helpful info.
      console.log('Error storing / signing / sending claim, 1:', e)
      console.log('Error storing / signing / sending claim, 2: ' + e)
      console.log('Error storing / signing / sending claim, 3:', e.toString())

      return { message: resultMessage }
    }
  }

  useFocusEffect(
    React.useCallback(() => {
      const doActions = async () => {

        // Doing this dance with SignatureResults page because otherwise coming
        // back here (eg. via bottom tab) will cause duplicate sends.

        Promise.all(finalCredSubjs.map((cred, index) => saveSignSend(cred, index)))
        .then((results) => navigation.replace('Sent Signature Results', { results }))
        .catch((e) => {
          setOneResultMessage(0, "Something failed in the signing or sending of one of the claims. See logs for details.")
          appStore.dispatch(appSlice.actions.addLog({log: true, msg: "Got overall error in SignSendToEndorser: " + e}))
        })
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
              <Text>
                {
                  (appStore.getState().settings.apiServer !== DEFAULT_ENDORSER_API_SERVER)
                   ? "Custom Servers"
                   : ""
                }
              </Text>

              <View>
                {
                  resultMessages.map((message, index) => (
                    <View style={{ height: 75 }} key={ index }>
                      {/** enforcing height because otherwise heights change on events which is jarring **/}
                      <Text>{ message }</Text>

                      {
                        fetched[index] ? (
                          endorserIds[index] ? (
                            <View>
                              <Text style={{ textAlign: "center" }}>Endorser ID { endorserIds[index] }</Text>
                            </View>
                          ) : ( /* fetched && !endorserId */
                            <Text>
                              Got response from the Endorser server but something went wrong.
                              The logs (near the bottom of Help) may show more info.
                            </Text>
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
            </View>
          ) : (
            <Text>You must create an identifier (under Settings).</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
