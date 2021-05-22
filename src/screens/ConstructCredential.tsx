import Debug from 'debug'
import * as didJwt from 'did-jwt'
import { DateTime, Duration } from 'luxon'
import * as R from 'ramda'
import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Button, FlatList, Modal, SafeAreaView, ScrollView, StyleSheet, Text, TouchableHighlight, TouchableOpacity, View } from 'react-native'

import { MASTER_COLUMN_VALUE, Settings } from '../entity/settings'
import * as utility from '../utility/utility'
import { appSlice, appStore } from '../veramo/appSlice'
import { agent, dbConnection } from '../veramo/setup'

const debug = Debug('endorser-mobile:share-credential')

export function ConstructCredentialScreen({ navigation }) {

  const [confirming, setConfirming] = useState<boolean>(false)
  const [identifiers, setIdentifiers] = useState<Identifier[]>([])
  const [hasMnemonic, setHasMnemonic] = useState<boolean>(false)
  const [loadedClaimsStarting, setLoadedClaimsStarting] = useState<DateTime>(null)
  const [loadingRecentClaims, setLoadingRecentClaims] = useState<boolean>(false)
  const [recentClaims, setRecentClaims] = useState<Array<any>>([])
  const [recentHiddenCount, setRecentHiddenCount] = useState<number>(0)
  const [selectedClaimsToConfirm, setSelectedClaimsToConfirm] = useState<Array<number>>([])

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
