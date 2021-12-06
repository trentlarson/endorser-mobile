import { DateTime, Duration } from 'luxon'
import * as R from 'ramda'
import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Button, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'

import * as utility from '../utility/utility'
import { appSlice, appStore } from '../veramo/appSlice'
import { agent, dbConnection } from '../veramo/setup'

export function ConfirmOthersScreen({ navigation }) {

  const [identifiers, setIdentifiers] = useState<Identifier[]>([])
  const [loadedClaimsStarting, setLoadedClaimsStarting] = useState<DateTime>(null)
  const [loadError, setLoadError] = useState<string>('')
  const [loadingRecentClaims, setLoadingRecentClaims] = useState<boolean>(false)
  const [recentClaims, setRecentClaims] = useState<Array<any>>([])
  const [recentHiddenCount, setRecentHiddenCount] = useState<number>(0)
  const [selectedClaimsToConfirm, setSelectedClaimsToConfirm] = useState<Array<number>>([])

  async function loadRecentClaims(ids) {
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
    const token = await utility.accessToken(ids[0])
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
      .catch((err) => {
        setLoadError('There was a problem retrieving claims to confirm.')
        appStore.dispatch(appSlice.actions.addLog({log: true, msg: "Got error loading claims to confirm: " + err}))
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

  /**
    return a string representation of the loaded date
   **/
  function monthDayLoaded() {
    let startPos = 0
    if (loadedClaimsStarting) {
      // I'd love to use diff and minus functions but I get an error "need to specify a reason the Duration is invalid"
      const yearAfterLoaded = loadedClaimsStarting.plus({ years: 1 })
      if (yearAfterLoaded.toMillis() > DateTime.now().toMillis()) {
        startPos = 5 // don't show the year
      }
    }
    return loadedClaimsStarting
      ? loadedClaimsStarting.toISO().substring(startPos, 10)
      : 'Now'
  }

  function anyTrue(values) {
    return R.any(R.identity, values)
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
    }
  }

  // Check for existing identifers on load and set them to state
  useEffect(() => {
    const getIdentifiers = async () => {
      const ids = await agent.didManagerFind()
      setIdentifiers(ids)

      loadRecentClaims(ids)

      utility.loadContacts(appSlice, appStore, dbConnection, true)
    }
    getIdentifiers()
  }, [])

  return (
    <View style={{ padding: 20 }}>
      <View syle={{ textAlign: 'left' }}>
        <FlatList
          ListHeaderComponent={
            <View>
              <Text style={{ fontSize: 30, fontWeight: 'bold' }}>Confirm</Text>
              <Text style={{ color: 'red' }}>{loadError}</Text>
            </View>
          }
          ListEmptyComponent={
            <Text style={{ padding: 10 }}>No visible claims found after { monthDayLoaded().toLowerCase() }.</Text>
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
                    onPress={() => loadRecentClaims(identifiers)}
                  />
              }
              <View style={{ marginTop: 10 }}/>
              <Button
                title="Set Confirmations"
                onPress={ setConfirmations }
              />
            </View>
          }
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  itemSelected: {
    backgroundColor: "#88FFFF",
  },
  line: {
    height: 0.8,
    width: "100%",
    backgroundColor: "rgba(0,0,0,0.9)",
  },
})