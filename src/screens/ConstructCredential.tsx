import crypto from 'crypto'
import Debug from 'debug'
import * as didJwt from 'did-jwt'
import { DateTime, Duration } from 'luxon'
import * as R from 'ramda'
import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Button, FlatList, Modal, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableHighlight, TouchableOpacity, View } from 'react-native'
import { CheckBox } from "react-native-elements"

import { MASTER_COLUMN_VALUE, Settings } from '../entity/settings'
import * as utility from '../utility/utility'
import { appSlice, appStore } from '../veramo/appSlice'
import { agent, dbConnection } from '../veramo/setup'

const debug = Debug('endorser-mobile:share-credential')

export function ConstructCredentialScreen({ navigation }) {

  const [identifiers, setIdentifiers] = useState<Identifier[]>([])
  const [hasMnemonic, setHasMnemonic] = useState<boolean>(false)

  // for confirmations
  const [confirming, setConfirming] = useState<boolean>(false)
  const [loadedClaimsStarting, setLoadedClaimsStarting] = useState<DateTime>(null)
  const [loadingRecentClaims, setLoadingRecentClaims] = useState<boolean>(false)
  const [recentClaims, setRecentClaims] = useState<Array<any>>([])
  const [recentHiddenCount, setRecentHiddenCount] = useState<number>(0)
  const [selectedClaimsToConfirm, setSelectedClaimsToConfirm] = useState<Array<number>>([])

  // for Grants
  const [askForGrant, setAskForGrant] = useState<boolean>(false)

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
    navigation.navigate('Sign Credential', { credentialSubject: claimObj })
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
        navigation.navigate('Sign Credential', { credentialSubject: fullClaim })
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
              <Text style={{ fontSize: 30, fontWeight: 'bold' }}>Create</Text>
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
                  onRequestClose={unsetConfirmationsModal}
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
                                ? <ActivityIndicator size="large" color="#00ff00" />
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
                  askForGrant
                  ? <GrantModal
                      id={ identifiers[0].did }
                      proceed={ claim => {
                        setAskForGrant(false)
                        navigation.navigate('Sign Credential', { credentialSubject: claim })
                      }}
                      cancel={ () => setAskForGrant(false) }
                    />
                  : <View/>
                }
                <View>
                  <Text>What do you want to assert?</Text>
                  <Button
                    title={'Attendance at ' + (todayIsSaturday ? 'Today\'s' : 'Last') + ' Meeting'}
                    onPress={setClaimToAttendance}
                  />
                  <View style={{ padding: 5 }} />
                  <Button
                    title={'Confirmation of Other Claims'}
                    onPress={() => {
                      setConfirming(true)
                      loadRecentClaims()
                      utility.loadContacts(appSlice, appStore, dbConnection, true)
                    }}
                  />
                  <View style={{ padding: 5 }} />
                  <Button
                    title={'Grant'}
                    onPress={() => setAskForGrant(true)}
                  />
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

  /**
    props has:
    - funderId string for the identifier of the sponsor
    - proceed function that takes the claim
    - cancel function
   **/
  function GrantModal(props) {

    const [comment, setComment] = useState<string>('')
    const [durationInHours, setDurationInHours] = useState<string>('1')
    const [expiration, setExpiration] = useState<string>(DateTime.local().plus(Duration.fromISO("P6M")).toISODate())
    const [fundedId, setFundedId] = useState<string>('')
    const [termsOfService, setTermsOfService] = useState<string>("Let's just talk beforehand about reasonable terms such as location, advance notice, amount of exertion, etc.")
    const [multipleTransfersAllowed, setMultipleTransfersAllowed] = useState<boolean>(false)
    const [transferAllowed, setTransferAllowed] = useState<boolean>(true)

    function grantClaim(grantId: string, funderId: string, fundedId: string, comments: string, durationInHours: string, expiration: string, termsOfService: string, transfersAllowed: number) {
      return {
        "@context": "https://schema.org",
        "@type": "Grant",
        // recommend adding non-standard properties as key:value pairs in descriptions until they evolve into standard properties
        "description": comments,
        "duration": "PT" + durationInHours + "H",
        "expires": expiration,
        "fundedItem": {
          "@type": "Person",
          "identifier": fundedId,
        },
        "sponsor": {
          "@type": "Person",
          "identifier": funderId
        },
        "numberOfTransfersAllowed": transfersAllowed,
        "termsOfService": termsOfService,
        "identifier": grantId,
      }
    }

    function grantClaimFromInputs() {
      return grantClaim(
        crypto.randomBytes(16).toString('hex'), // 128 bits seems OK
        props.id,
        fundedId,
        comment,
        durationInHours,
        expiration,
        termsOfService,
        multipleTransfersAllowed ? Number.MAX_SAFE_INTEGER : transferAllowed ? 1 : 0
      )
    }

    return (
      <Modal
        animationType="slide"
        transparent={true}
        onRequestClose={props.cancel}
      >
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <View>
              <Text style={styles.modalText}>Grant</Text>

              <View style={{ padding: 5 }}>
                <Text>Recipient</Text>
                <TextInput
                  value={fundedId}
                  onChangeText={setFundedId}
                  editable
                  style={{ borderWidth: 1 }}
                  autoCapitalize={'none'}
                  autoCorrect={false}
                />
              </View>

              <View style={{ padding: 5 }}>
                <Text>Number of Hours</Text>
                <TextInput
                  value={durationInHours}
                  onChangeText={setDurationInHours}
                  editable
                  length={ 5 }
                  style={{ borderWidth: 1 }}
                />
              </View>

              <View style={{ padding: 5 }}>
                <Text>Expiration</Text>
                <TextInput
                  value={expiration}
                  onChangeText={setExpiration}
                  editable
                  style={{ borderWidth: 1 }}
                />
              </View>

              <View style={{ padding: 5 }}>
                <Text>Comment</Text>
                <TextInput
                  value={comment}
                  onChangeText={setComment}
                  editable
                  multiline={true}
                  style={{ borderWidth: 1 }}
                />
              </View>

              <View style={{ padding: 5 }}>
                <Text>Terms</Text>
                <TextInput
                  value={termsOfService}
                  onChangeText={setTermsOfService}
                  editable
                  multiline={true}
                  style={{ borderWidth: 1 }}
                />
              </View>

              <View style={{ padding: 5 }}>
                <CheckBox
                  title='Transfer Allowed?'
                  checked={transferAllowed}
                  onPress={() => {setTransferAllowed(!transferAllowed)}}
                />
                <View style={{ padding: 5, display: (transferAllowed ? 'flex' : 'none') }}>
                  <CheckBox
                    title='Multiple Transfers Allowed?'
                    checked={multipleTransfersAllowed}
                    onPress={() => {setMultipleTransfersAllowed(!multipleTransfersAllowed)}}
                    visible={transferAllowed}
                  />
                </View>
              </View>

              <View style={{ padding: 10 }} />
              <TouchableHighlight
                style={styles.cancelButton}
                onPress={props.cancel}
              >
                <Text>Cancel</Text>
              </TouchableHighlight>
              <TouchableHighlight
                style={styles.saveButton}
                onPress={() => props.proceed(grantClaimFromInputs())}
              >
                <Text>Set</Text>
              </TouchableHighlight>
            </View>
          </View>
        </View>
      </Modal>
    )
  }

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
