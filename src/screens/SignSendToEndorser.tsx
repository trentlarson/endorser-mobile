import Debug from 'debug'
import * as didJwt from 'did-jwt'
import { DateTime, Duration } from 'luxon'
import * as R from 'ramda'
import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Button, FlatList, Linking, Modal, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableHighlight, TouchableOpacity, View } from 'react-native'

import { MASTER_COLUMN_VALUE, Settings } from '../entity/settings'
import * as utility from '../utility/utility'
import { appSlice, appStore } from '../veramo/appSlice'
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
  const [loadedClaimsStarting, setLoadedClaimsStarting] = useState<DateTime>(null)
  const [loadingRecentClaims, setLoadingRecentClaims] = useState<boolean>(false)
  const [recentClaims, setRecentClaims] = useState<Array<any>>([])
  const [recentHiddenCount, setRecentHiddenCount] = useState<number>(0)
  const [selectedClaimsToConfirm, setSelectedClaimsToConfirm] = useState<Array<number>>([])

  const endorserViewLink = (endorserId) => {
    return appStore.getState().viewServer + '/reportClaim?claimId=' + endorserId
  }

  let currentOrPreviousSat = DateTime.local()
  let todayIsSaturday = true
  if (currentOrPreviousSat.weekday !== 6) {
    // it's not Saturday, so let's default to last Saturday
    currentOrPreviousSat = currentOrPreviousSat.minus({week:1})
    todayIsSaturday = false
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

  function unsetConfirmationsModal() {
    setConfirming(false)
    setLoadedClaimsStarting(null)
    setRecentClaims([])
    setRecentHiddenCount(0)
    setSelectedClaimsToConfirm([])
  }

  function setConfirmations() {
    const values = Object.values(selectedClaimsToConfirm)
    if (!anyTrue(values)) {
      Alert.alert("Select a Claim", "In order to confirm, you must select at least one claim.")
    } else {
      const claims = values.map(R.prop('claim'))
      const onlyGoodClaims = R.reject(R.isNil, claims)
      if (onlyGoodClaims.length > 0) {
        const fullClaim = {
          "@context": "http://schema.org",
          "@type": "AgreeAction",
          "object": onlyGoodClaims
        }
        setClaimStr(JSON.stringify(fullClaim))
      }
      unsetConfirmationsModal()
    }
  }

  function anyTrue(values) {
    return R.any(R.identity, values)
  }

  async function loadRecentClaims() {
    setLoadingRecentClaims(true)

    let loadMoreEnding, loadMoreStarting
    if (!loadedClaimsStarting) {
      loadMoreEnding = DateTime.local()
      loadMoreStarting = DateTime.local().startOf("day")
    } else {
      loadMoreEnding = loadedClaimsStarting
      loadMoreStarting = loadedClaimsStarting.minus(Duration.fromISO("P1M")) // - 1 month
    }
    let loadMoreEndingStr = loadMoreEnding.toISO()
    let loadMoreStartingStr = loadMoreStarting.toISO()

    const endorserApiServer = appStore.getState().apiServer
    const token = await utility.accessToken(identifiers[0])
    fetch(endorserApiServer + '/api/claim/?issuedAt_greaterThanOrEqualTo=' + loadMoreStartingStr + "&issuedAt_lessThan=" + loadMoreEndingStr + "&excludeConfirmations=true", {
      headers: {
        "Content-Type": "application/json",
        "Uport-Push-Token": token,
      }})
      .then(response => response.json())
      .then(async (data) => {
        const dataWithoutHidden = R.reject(utility.containsHiddenDid, data)
        setRecentClaims(R.concat(recentClaims, dataWithoutHidden))
        setRecentHiddenCount(count => count + data.length - dataWithoutHidden.length)
        setLoadedClaimsStarting(loadMoreStarting)
      })
      .finally(() => setLoadingRecentClaims(false))
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
    const token = await utility.accessToken(identifiers[0])
    fetch(endorserApiServer + '/api/claim', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Uport-Push-Token': token,
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

  function toggleSelectedClaim(claim) {
    const claimIdStr = claim.id.toString()
    const recordVal =
      selectedClaimsToConfirm[claimIdStr]
      ? undefined
      : claim
    setSelectedClaimsToConfirm(record => R.set(R.lensProp(claimIdStr), recordVal, record))
  }

  function monthDayLoaded() {
    return loadedClaimsStarting
      ? loadedClaimsStarting.toISO().substring(5, 10).replace('-', '/')
      : 'Now'
  }

  function formatClaimJson() {
    if (claimStr) {
      try {
        return JSON.stringify(JSON.parse(claimStr), null, 2)
      } catch (e) {
        console.log('Got an error parsing JSON in claim input.', e)
        setTimeout(() => { throw e }, 100) // show error, though they can minimize it
        return claimStr
      }
    } else {
      return ''
    }
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
              <Text style={{ fontSize: 11 }}>{identifiers[0].did}</Text>
              { !hasMnemonic ? (
                <Text style={{ padding: 10, color: 'red' }}>There is no backup available for this ID. We recommend you generate a different identifier and do not keep using this one. (See Help.)</Text>
              ) : (
                 <Text/>
              )}
              <View style={{ padding: 10 }}>
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
                      <View syle={{ textAlign: 'left' }}>
                        <FlatList
                          ListHeaderComponent={
                            <Text style={styles.modalText}>Confirmations</Text>
                          }
                          ListEmptyComponent={
                            <Text>No visible claims found after { monthDayLoaded().toLowerCase() }.</Text>
                          }
                          data={recentClaims}
                          ItemSeparatorComponent={() => <View style={styles.line} />}
                          keyExtractor={item => item.id.toString()}
                          renderItem={data =>
                            <TouchableOpacity
                              style={ (selectedClaimsToConfirm[data.item.id.toString()] ? styles.itemSelected : {}) }
                              onPress={() => { toggleSelectedClaim(data.item) }}>
                              <Text>{utility.claimDescription(data.item, identifiers, appStore.getState().contacts || [])}</Text>
                            </TouchableOpacity>
                          }
                          ListFooterComponent={
                            <View style={{ textAlign: 'center' }} >
                              <Text style={{ padding:5 }}>{ recentHiddenCount > 0
                                ? '(' + recentHiddenCount + ' are hidden)'
                                : ''
                              }</Text>
                              { loadingRecentClaims
                                ? <ActivityIndicator size={'large'} />
                                : <Button
                                    title={'Load Previous to ' + monthDayLoaded()}
                                    onPress={loadRecentClaims}
                                  />
                              }
                              <TouchableHighlight
                                style={styles.cancelButton}
                                onPress={unsetConfirmationsModal}
                              >
                                <Text>Cancel</Text>
                              </TouchableHighlight>
                              <TouchableHighlight
                                style={styles.saveButton}
                                onPress={setConfirmations}
                              >
                                <Text>Set</Text>
                              </TouchableHighlight>
                            </View>
                          }
                        />
                      </View>
                    </View>
                  </View>
                </Modal>
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
                          setFetched(false)
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

                      !claimStr ? (
                        <View>
                          <Text>What do you want to assert?</Text>
                          <Button
                            title={'Attendance at ' + (todayIsSaturday ? 'Today\'s' : 'Last') + ' Meeting'}
                            onPress={setClaimToAttendance}
                          />
                          <Button
                            title={'Confirmation of Other Claims'}
                            onPress={() => {
                              setConfirming(true)
                              loadRecentClaims()
                              utility.loadContacts(appSlice, appStore, dbConnection)
                            }}
                          />
                        </View>
                      ) : ( /* !fetched && !fetching && claimStr */
                        <View/>
                      )
                    )
                  )
                }
                {
                  claimStr ? (
                    <View>
                      <Button
                        title={'Sign & Store'}
                        onPress={signAndSend}
                      />
                      <Button
                        title={'Reset'}
                        onPress={() => setClaimStr('')}
                      />
                      <Text>Claim Details</Text>
                      <TextInput
                        multiline={true}
                        style={{ borderWidth: 1, height: 300 }}
                        onChangeText={setClaimStr}
                      >
                        { formatClaimJson() }
                      </TextInput>
                    </View>
                  ) : (
                    <View/>
                  )
                }
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
  itemSelected: {
    backgroundColor: "#88FFFF",
  },
  line: {
    height: 0.8,
    width: "100%",
    backgroundColor: "rgba(0,0,0,0.9)"
  },
  cancelButton: {
    alignItems: 'center',
    backgroundColor: "#F194FF",
    borderRadius: 20,
    padding: 10,
    elevation: 2,
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: "#00FF00",
    borderRadius: 20,
    padding: 10,
    elevation: 2,
  },
  textStyle: {
    color: "white",
    fontWeight: "bold",
    textAlign: "center"
  },
  modalText: {
    marginBottom: 15,
    textAlign: "center"
  },
})
