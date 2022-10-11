import { DateTime, Duration } from 'luxon'
import * as R from 'ramda'
import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Button, FlatList, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { CheckBox } from "react-native-elements"

import { styles } from './style'
import * as utility from '../utility/utility'
import { YamlFormat } from '../utility/utility.tsx'
import { appSlice, appStore } from '../veramo/appSlice'
import { agent, dbConnection } from '../veramo/setup'

export function ConfirmOthersScreen({ navigation }) {

  const [loadedClaimsStarting, setLoadedClaimsStarting] = useState<DateTime>(null)
  const [loadError, setLoadError] = useState<string>('')
  const [loadingRecentClaims, setLoadingRecentClaims] = useState<boolean>(false)
  const [recentClaims, setRecentClaims] = useState<Array<any>>([])
  const [recentHiddenCount, setRecentHiddenCount] = useState<number>(0)
  const [selectedClaimsToConfirm, setSelectedClaimsToConfirm] = useState<Array<number>>([])

  async function loadRecentClaims(ids) {
    if (ids == null && ids[0] == null) {
      Alert.alert("You have no identifiers. Go to the Settings page and create one.")
    } else {
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

      const endorserApiServer = appStore.getState().settings.apiServer
      const token = await utility.accessToken(ids[0])
      return fetch(endorserApiServer + '/api/claim/?issuedAt_greaterThanOrEqualTo=' + encodeURIComponent(loadMoreStartingStr) + "&issuedAt_lessThan=" + encodeURIComponent(loadMoreEndingStr) + "&excludeConfirmations=true", {
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
        const fullClaims = onlyGoodClaims.map(aClaim => {
          if (aClaim['@context'] === 'https://schema.org') {
            aClaim['@context'] = undefined
          }
          return {
            "@context": "https://schema.org",
            "@type": "AgreeAction",
            "object": aClaim,
          }
        })
        navigation.push(utility.REVIEW_SIGN_SCREEN_NAV, { credentialSubject: fullClaims })
      }
    }
  }

  // load recent claims based on identifiers
  useEffect(() => {
    const getIdentifiers = async () => {
      loadRecentClaims(appStore.getState().identifiers)

      agent.didManagerFind() // without this it shows some errors at app start (even though the app all works)
    }
    getIdentifiers()
  }, [])

  return (
    <SafeAreaView>
    <View style={{ padding: 20 }}>
      <View syle={{ textAlign: 'left' }}>
        <FlatList
          ListHeaderComponent={
            <View>
              <Text style={{ fontSize: 30, fontWeight: 'bold' }}>Confirm</Text>
              <Text style={{ color: 'red' }}>{loadError}</Text>
              <Button
                title="Finish..."
                onPress={ setConfirmations }
              />
              <View style={styles.line}/>
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
            >
              {/* Why does any CheckBox in here show the startup errors in the UI when you start the app, eg "Please provide SecretBox to the KeyStore"? Those errors are in the console on every run, but they only show in the UI when I put a CheckBox in this screen.
              <Text>{ utility.claimSummary(data.item) }</Text>
              <CheckBox
                title={ <YamlFormat source={ data.item.claim || data.item } navigation={ navigation } /> }
                checked={!!selectedClaimsToConfirm[data.item.id.toString()]}
                onPress={() => { toggleSelectedClaim(data.item) }}
              />
              */}
              <Text onPress={() => { toggleSelectedClaim(data.item) }}>
                <Text>{ utility.claimSummary(data.item) + "\n" }</Text>
                <Text>{
                  utility.claimSpecialDescription(data.item, appStore.getState().identifiers || [], appStore.getState().contacts || [])
                  || <YamlFormat source={ data.item.claim || data.item } navigation={ navigation } />
                  }
                </Text>
                { "\n" }
                <Text style={{ color: "blue" }}>{ selectedClaimsToConfirm[data.item.id.toString()] ? "(unselect)" : "(select)" }</Text>
              </Text>
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
                    onPress={() => loadRecentClaims(appStore.getState().identifiers)}
                  />
              }
              <View style={{ marginTop: 10 }}/>
              <Button
                title="Finish..."
                onPress={ setConfirmations }
              />
            </View>
          }
        />
      </View>
    </View>
    </SafeAreaView>
  )
}
