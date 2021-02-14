import Debug from 'debug'
import * as didJwt from 'did-jwt'
import { DateTime } from 'luxon'
import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Button, Linking, Modal, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableHighlight, View } from 'react-native'

import { MASTER_COLUMN_VALUE, Settings } from '../entity/settings'
import { appStore } from '../veramo/appSlice'
import { agent, dbConnection } from '../veramo/setup'

const debug = Debug('endorser-mobile:share-credential')

export function CredentialsScreen({ navigation }) {
  const [claimStr, setClaimStr] = useState<string>('')
  const [confirming, setConfirming] = useState<boolean>(false)
  const [endorserId, setEndorserId] = useState<string>(null)
  const [fetched, setFetched] = useState<boolean>(false)
  const [fetching, setFetching] = useState<boolean>(false)
  const [identifiers, setIdentifiers] = useState<Identifier[]>([])
  const [hasMnemonic, setHasMnemonic] = useState<boolean>(false)
  const [jwt, setJwt] = useState<JWT>()

  const endorserViewLink = (endorserId) => {
    return appStore.getState().viewServer + '/reportClaim?claimId=' + endorserId
  }

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

  function setClaimToAttendance() {
    const claimObj = bvcClaim(identifiers[0] ? identifiers[0].did : 'UNKNOWN', TODAY_OR_PREV_START_DATE)
    setClaimStr(JSON.stringify(claimObj))
  }

  function setConfirmation() {
    setClaimStr(JSON.stringify('Ummmm... Unimplemented'))
    setConfirming(false)
  }

  function vcPayload(did: string, claim: any): JwtCredentialPayload {
    return {
      sub: did,
      vc: {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiableCredential'],
        credentialSubject: claim,
      }
    }
  }

  async function sendToEndorserSite(jwt: string) {
    setFetching(true)
    const endorserApiServer = appStore.getState().apiServer
    fetch(endorserApiServer + '/api/claim', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Uport-Push-Token': jwt,
      },
      body: JSON.stringify({ jwtEncoded: jwt }),
    })
    .then(async resp => {
      setFetching(false)
      setFetched(true)
      debug('Got endorser.ch status', resp.status)
      if (resp.ok) {
        return resp.json()
      } else {
        const text = await resp.text()
        throw Error('Got failure response code of ' + resp.status + ' with body text of ' + text)
      }
    })
    .then(json => {
      debug('Got endorser.ch result', json)
      setEndorserId(json)
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
    const vcClaim = JSON.parse(claimStr)
    const vcJwt: string = await didJwt.createJWT(vcPayload(did, vcClaim),{ issuer: did, signer })
    setJwt(vcJwt)
    sendToEndorserSite(vcJwt)
  }

  // Check for existing identifers on load and set them to state
  useEffect(() => {
    const getIdentifiers = async () => {
      const _ids = await agent.didManagerFind()
      setIdentifiers(_ids)

      const conn = await dbConnection
      let settings = await conn.manager.findOne(Settings, MASTER_COLUMN_VALUE)
      if (settings?.mnemonic) {
        setHasMnemonic(true)
      }
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
              <Text style={{ fontSize: 12 }}>{identifiers[0].did}</Text>
              { !hasMnemonic ? (
                <Text style={{ padding: 10, color: 'red' }}>There is no backup available for this ID. We recommend you generate a different identifier and do not keep using this one. (See Help.)</Text>
              ) : (
                 <Text/>
              )}
              <View style={{ padding: 10 }}>
                {
                  fetched ? (
                    endorserId ? (
                      <Button
                        title="Success!  Click here to see your claim on Endorser.ch"
                        onPress={() => {
                          Linking.openURL(endorserViewLink(endorserId)).catch(err =>
                            setError(
                              'Sorry, something went wrong trying to go to endorser.ch',
                            ),
                          )
                        }}
                      />
                    ) : ( /* fetched && !endorserId */
                      <Text>Got response from Endorser.ch but something went wrong.  You might check your data.  If it's good it may be an error at Endorser.ch</Text>
                    )
                  ) : ( /* !fetched */
                    fetching ? (
                      <View>
                        <Text>Saving to Endorser.ch server...</Text>
                        <ActivityIndicator size={'large'} />
                      </View>
                    ) : ( /* !fetched && !fetching */
                      <Text/>
                    )
                  )
                }
                <Modal
                  animationType="slide"
                  transparent={true}
                  visible={confirming}
                  onRequestClose={() => {
                    Alert.alert("Modal has been closed.");
                  }}
                >
                  <View style={styles.centeredView}>
                    <View style={styles.modalView}>
                          <Text style={styles.modalText}>Save this contact?</Text>

                          <TouchableHighlight
                            style={styles.cancelButton}
                            onPress={() => { setConfirming(false) }}
                          >
                            <Text>Cancel</Text>
                          </TouchableHighlight>
                          <TouchableHighlight
                            style={styles.saveButton}
                            onPress={setConfirmation}
                          >
                            <Text>Save</Text>
                          </TouchableHighlight>
                    </View>
                  </View>
                </Modal>
                {
                  !claimStr ? (
                    <View>
                      <Text>Select Claim</Text>
                      <Button
                        title={'Attend'}
                        onPress={setClaimToAttendance}
                      />
                      <Button
                        title={'Confirm'}
                        onPress={() => setConfirming(true) }
                      />
                    </View>
                  ) : ( /* claimStr */
                    <View>
                      <Button
                        title={'Sign & Store'}
                        onPress={signAndSend}
                      />
                      <Button
                        title={'Reset'}
                        onPress={() => setClaimStr('')}
                      />
                      <Text>Claim</Text>
                      <TextInput
                        multiline={true}
                        style={{ borderWidth: 1, height: 300 }}
                        onChangeText={setClaimStr}
                      >
                        { JSON.stringify(JSON.parse(claimStr), null, 2) }
                      </TextInput>
                      { jwt ? (
                        <View>
                          <Text>JWT</Text>
                          <TextInput
                            multiline={true}
                            style={{ borderWidth: 1, height: 300 }}
                          >
                            { jwt }
                          </TextInput>
                        </View>
                      ) : ( /* claimStr && !jwt */
                        <Text/>
                      )}
                    </View>
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

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 22
  },
  modalView: {
    margin: 20,
    backgroundColor: "white",
    borderRadius: 20,
    padding: 35,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5
  },
  cancelButton: {
    backgroundColor: "#F194FF",
    borderRadius: 20,
    padding: 10,
    elevation: 2
  },
  saveButton: {
    backgroundColor: "#00FF00",
    borderRadius: 20,
    padding: 10,
    elevation: 2
  },
  textStyle: {
    color: "white",
    fontWeight: "bold",
    textAlign: "center"
  },
  modalText: {
    marginBottom: 15,
    textAlign: "center"
  }
})
