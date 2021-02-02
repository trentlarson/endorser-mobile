import Debug from 'debug'
import * as didJwt from 'did-jwt'
import { DateTime } from 'luxon'
import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Button, Linking, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native'

import { agent } from '../veramo/setup'

const ENDORSER_API_SERVER = 'http://10.0.0.88:3000'
const ENDORSER_VIEW_SERVER = 'http://10.0.0.88:3001'
const debug = Debug('endorser-mobile:share-credential')

function endorserLink(endorserId) {
  return ENDORSER_VIEW_SERVER + '/reportClaim?claimId=' + endorserId
}

export function CredentialsScreen({ navigation }) {
  const [claim, setClaim] = useState<string>('{}')
  const [endorserId, setEndorserId] = useState<string>(null)
  const [fetched, setFetched] = useState<boolean>(false)
  const [fetching, setFetching] = useState<boolean>(false)
  const [identifiers, setIdentifiers] = useState<Identifier[]>([])
  const [jwt, setJwt] = useState<JWT>()

  let currentOrPreviousSat = DateTime.local()
  if (currentOrPreviousSat.weekday < 6) {
    // it's not Saturday, so let's default to last Saturday
    currentOrPreviousSat = currentOrPreviousSat.minus({week:1})
  }
  const eventStartDateObj = currentOrPreviousSat.set({weekday:6}).set({hour:9}).startOf("hour")
  // Hack, but the full ISO pushes the length to 340 which crashes verifyJWT!  Crazy!
  const TODAY_OR_PREV_START_DATE = eventStartDateObj.toISO({suppressMilliseconds:true})

  function bvcClaim(did: string, startTime: string) {
    return {
      '@context': 'http://schema.org',
      '@type': 'JoinAction',
      agent: {
        did: did,
      },
      event: {
        organizer: {
          name: 'Bountiful Voluntaryist Community',
        },
        name: 'Saturday Morning Meeting',
        startTime: startTime,
      }
    }
  }

  function vcPayload(did: string, claim: any): JwtCredentialPayload {
    return {
      sub: did,
      vc: {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiableCredential'],
        credentialSubject: claim
      }
    }
  }

  async function sendToEndorserSite(jwt: string) {
    setFetching(true)
    fetch(ENDORSER_API_SERVER + '/api/claim', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Uport-Push-Token': jwt,
      },
      body: JSON.stringify({ jwtEncoded: jwt }),
    })
    .then(resp => {
      setFetching(false)
      setFetched(true)
      debug('Got endorser.ch status', resp.status)
      return resp.json()
    })
    .then(json => {
      debug('Got endorser.ch result', json)
      setEndorserId(json)
    })
    .catch(err => {
      debug('Got error sending to endorser.ch', err)
      throw Error(
        'Sorry, got a problem with the endorser.ch response. ' + err,
      )
    })
    .finally(() => {
      setFetching(false)
    })

  }

  async function signAndSend() {
    /**
    // would like to use https://www.npmjs.com/package/did-jwt-vc
    // but: "TypeError: Object is not a constructor (evaluating 'new EthrDID')"
    const issuer: Issuer = new EthrDID({
      address: '0xf1232f840f3ad7d23fcdaa84d6c66dac24efb198',
      privateKey: 'd8b595680851765f38ea5405129244ba3cbad84467d190859f4c8b20c1ff6c75'
    })
    const vcJwt: JWT = await createVerifiableCredentialJwt(vcPayload, issuer)
    **/

    const signer = didJwt.SimpleSigner(identifiers[0].keys[0].privateKeyHex)
    const did: string = identifiers[0].did
    const vcJwt: string = await didJwt.createJWT(vcPayload(did, claim),{ issuer: did, signer })
    setJwt(vcJwt)
    sendToEndorserSite(vcJwt)
  }

  // Check for existing identifers on load and set them to state
  useEffect(() => {
    const getIdentifiers = async () => {
      const _ids = await agent.didManagerFind()
      setIdentifiers(_ids)
      const claimObj = bvcClaim(_ids[0] ? _ids[0].did : 'UNKNOWN', TODAY_OR_PREV_START_DATE)
      setClaim(JSON.stringify(claimObj))
    }
    getIdentifiers()
  }, [])

  return (
    <SafeAreaView>
      <ScrollView>
        <View style={{ padding: 20 }}>
          { identifiers[0] ? (
            <View>
              <Text style={{ fontSize: 30, fontWeight: 'bold' }}>Credentials</Text>
              <Text style={{ fontSize: 12 }}>For {identifiers[0].did}</Text>
              { fetching ? (
                  <View>
                    <Text>Saving to Endorser.ch...</Text>
                    <ActivityIndicator size={'small'} />
                  </View>
                ) : (
                  fetched ? (
                    endorserId ? (
                      <Button
                        title="Success!  Click here to see your claim on Endorser.ch"
                        onPress={() => {
                          Linking.openURL(endorserLink(endorserId)).catch(err =>
                            setError(
                              'Sorry, something went wrong trying to go to endorser.ch',
                            ),
                          )
                        }}
                      />
                    ) : (
                      <Text>Got response from Endorser.ch...</Text>
                    )
                  ) : (
                    <Button
                      title={'Click to sign & store'}
                      onPress={() => signAndSend()}
                    />
                  )
                )
              }
              { jwt ? (
                <View>
                  <Text>JWT</Text>
                  <TextInput
                    multiline={true}
                    style={{ borderWidth: 1, height: 300 }}
                    editable={false}
                  >
                    { jwt }
                  </TextInput>
                </View>
              ) : (
                <Text/>
              )}
              <Text>Claim</Text>
              <TextInput
                multiline={true}
                style={{ borderWidth: 1, height: 300 }}
                onChangeText={setClaim}
              >
                { JSON.stringify(JSON.parse(claim), null, 2) }
              </TextInput>
            </View>
          ) : (
            <Text>You must create an identifier (under Settings).</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

