import Debug from 'debug'
import * as didJwt from 'did-jwt'
import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Button, Linking, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native'

import { MASTER_COLUMN_VALUE, Settings } from '../entity/settings'
import * as utility from '../utility/utility'
import { appSlice, appStore } from '../veramo/appSlice'
import { agent, dbConnection } from '../veramo/setup'

const debug = Debug('endorser-mobile:share-credential')

export function SignCredentialScreen({ navigation, route }) {

  const { credentialSubject } = route.params

  const [claimJsonError, setClaimJsonError] = useState<string>(null)
  const [claimStr, setClaimStr] = useState<string>(JSON.stringify(credentialSubject))
  const [endorserId, setEndorserId] = useState<string>(null)
  const [fetched, setFetched] = useState<boolean>(false)
  const [fetching, setFetching] = useState<boolean>(false)
  const [hasMnemonic, setHasMnemonic] = useState<boolean>(false)
  const [id0, setId0] = useState<Identifier>()
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
    const token = await utility.accessToken(id0)
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
   * return claim ID from Endorser server
   */
  async function signAndSend(): string {
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
      const signer = didJwt.SimpleSigner(id0.keys[0].privateKeyHex)
      const did: string = id0.did
      const vcClaim = JSON.parse(claimStr)
      appStore.dispatch(appSlice.actions.addLog({log: false, msg: "... created signer and now signing..."}))
      const vcJwt: string = await didJwt.createJWT(utility.vcPayload(did, vcClaim),{ issuer: did, signer })
      setJwt(vcJwt)
      appStore.dispatch(appSlice.actions.addLog({log: false, msg: "... created signed JWT and now sending..."}))
      let result = await sendToEndorserSite(vcJwt)
      appStore.dispatch(appSlice.actions.addLog({log: false, msg: "... finished the signing & sending with result: " + JSON.stringify(result)}))
      return result
    } catch (e) {
      appStore.dispatch(appSlice.actions.addLog({log: true, msg: "Got error in SignSendToEndorser.signAndSend: " + e}))

      // I have seen cases where each of these give different, helpful info.
      console.log('Error storing identifier, 1:', e)
      console.log('Error storing identifier, 2: ' + e)
      console.log('Error storing identifier, 3:', e.toString())
      throw e
    }
  }

  function formatClaimJson(claimString) {
    if (claimString) {
      try {
        return JSON.stringify(JSON.parse(claimString), null, 2)
      } catch (err) {
        return claimString
      }
    } else {
      return ''
    }
  }

  function changeCurlyQuotes() {
    setClaimStr(claimStr.replace(/”/g, "\"").replace(/“/g, "\""))
  }
  function hasCurlyQuotes() {
    return claimStr && (claimStr.match(/”/) || claimStr.match(/“/))
  }

  // Check for existing identifers on load and set them to state
  useEffect(() => {
    const getIdentifier = async () => {
      setId0(appStore.getState().identifiers && appStore.getState().identifiers[0])

      let settings = appStore.getState().settings
      if (settings?.mnemEncrBase64 || settings?.mnemonic) {
        setHasMnemonic(true)
      }
    }
    getIdentifier()
  }, [])

  useEffect(() => {
    if (claimStr == null || claimStr.trim() == '') {
      setClaimJsonError('The claim is empty.')
    } else {
      try {
        JSON.stringify(JSON.parse(claimStr), null, 2)
        setClaimJsonError('')
      } catch (err) {
        setClaimJsonError('The claim is not formatted correctly. ' + err)
      }
    }
  }, [claimStr])

  return (
    <SafeAreaView>
      <ScrollView>
        <View style={{ padding: 20 }}>
          { id0 ? (
            <View>
              <Text style={{ fontSize: 30, fontWeight: 'bold' }}>Sign</Text>
              <View style={{ padding: 10 }}>
                {
                  fetched ? (
                    endorserId ? (
                      <Button
                        title="Success!  Click here to see your claim on the Endorser server."
                        onPress={() => {
                          Linking.openURL(endorserViewLink(endorserId)).catch(err =>
                            setError(
                              'Sorry, something went wrong trying to go to the Endorser server.',
                            ),
                          )
                          setFetched(false)
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

                      claimStr ? (
                        <View/>
                      ) : ( /* !fetched && !fetching && !claimStr */
                        <Text>No claim found.  Go back and try again.</Text>
                      )
                    )
                  )
                }

                <View>
                  <View style={{ padding: 5 }} />
                  {
                    (claimJsonError && claimJsonError.length > 0)
                    ?
                      <Text style={{ textAlign: 'center' }}>Sign & Store{'\n'}(... after fixing the formatting error.)</Text>
                    :
                      <Button
                        title={'Sign & Store'}
                        onPress={signAndSend}
                      />
                  }
                  <Text style={{ marginTop: 75, marginBottom: 5 }}>Claim Details for Your Review:</Text>
                  <Text style={{ fontSize: 11 }}>{id0.did}</Text>
                  { !hasMnemonic ? (
                    <Text style={{ padding: 10, color: 'red' }}>There is no backup available for this ID. We recommend you generate a different identifier and do not keep using this one. (See Help.)</Text>
                  ) : (
                     <Text/>
                  )}
                  <TextInput
                    multiline={true}
                    style={{ borderWidth: 1, height: 300 }}
                    onChangeText={setClaimStr}
                    autoCorrect={false}
                  >
                    { formatClaimJson(claimStr) }
                  </TextInput>
                  <Text style={{ color: 'red' }}>{ claimJsonError }</Text>
                  {
                    hasCurlyQuotes()
                    ?
                      <Button
                        title={'Change Curly Quotes To Regular Quotes'}
                        onPress={changeCurlyQuotes}
                      />
                    :
                      <View/>
                  }
                </View>

                {
                  jwt ? (
                    <View>
                      <View style={{ marginTop: 800 }} />
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
