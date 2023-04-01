import { DateTime, Duration } from 'luxon'
import * as R from 'ramda'
import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator, Alert, Button, FlatList, SafeAreaView, ScrollView, Text, TouchableOpacity, View
} from 'react-native'
import { CheckBox } from "react-native-elements"

import { styles } from './style'
import * as utility from '../utility/utility'
import { YamlFormat } from '../utility/utility.tsx'
import { appSlice, appStore } from '../veramo/appSlice'
import { agent, dbConnection } from '../veramo/setup'
import Icon from "react-native-vector-icons/FontAwesome";

export function ConfirmOthersScreen({ navigation }) {

  const [loadedClaimsStarting, setLoadedClaimsStarting] = useState<DateTime>(null)
  const [loadError, setLoadError] = useState<string>('')
  const [loadingRecentClaims, setLoadingRecentClaims] = useState<boolean>(false)
  const [recentClaims, setRecentClaims] = useState<Array<any>>([])
  const [recentHiddenCount, setRecentHiddenCount] = useState<number>(0)
  const [selectedRecordsToConfirm, setSelectedRecordsToConfirm] = useState<Array<string>>([])
  const [showDetails, setShowDetails] = useState<Record<string, boolean>>({})

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
      return fetch(
        endorserApiServer + '/api/claim/?'
        + 'issuedAt_greaterThanOrEqualTo=' + encodeURIComponent(loadMoreStartingStr)
        + '&issuedAt_lessThan=' + encodeURIComponent(loadMoreEndingStr)
        + '&excludeConfirmations=true',
        {
          headers: {
            "Content-Type": "application/json",
            "Uport-Push-Token": token,
          }
        }
      )
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
      selectedRecordsToConfirm[claimIdStr]
      ? undefined
      : claim
    setSelectedRecordsToConfirm(record => R.set(R.lensProp(claimIdStr), recordVal, record))
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
    const values = Object.values(selectedRecordsToConfirm)
    if (!anyTrue(values)) {
      Alert.alert("Select a Claim", "In order to confirm, you must select at least one claim.")
    } else {
      const onlyGoodRecords = R.reject(R.isNil, values)
      if (onlyGoodRecords.length > 0) {
        const fullClaims = onlyGoodRecords.map(record => {
          const goodClaim = utility.removeSchemaContext(
            utility.removeVisibleToDids(
              utility.addHandleAsIdIfMissing(record.claim, record.handleId)
            )
          )
          return {
            "@context": "https://schema.org",
            "@type": "AgreeAction",
            "object": goodClaim,
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
      <ScrollView horizontal={ true } style={{ textAlign: 'left' }}>
        <FlatList
          ListHeaderComponent={
            <View>
              <Text style={{ fontSize: 30, fontWeight: 'bold' }}>Confirm</Text>
              <Text style={{ color: 'red' }}>{loadError}</Text>
              <Button
                title="Proceed to Sign"
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
              style={ (selectedRecordsToConfirm[data.item.id.toString()] ? styles.itemSelected : {}) }
            >
              <View style={{ flexDirection: 'row' }}>
                <CheckBox
                  title=""
                  checked={!!selectedRecordsToConfirm[data.item.id.toString()]}
                  onPress={() => { toggleSelectedClaim(data.item) }}
                />
                <Text style={{ marginTop: 20 }}>
                  {
                    utility.claimSpecialDescription(
                      data.item,
                      appStore.getState().identifiers || [],
                      appStore.getState().contacts || []
                    )
                  }
                </Text>
                <View style={{ marginLeft: 10 }} />
                {
                  showDetails[data.item.id.toString()]
                  ? (
                      <Icon
                        name="chevron-up"
                        onPress={() => setShowDetails(
                          prev => R.set(
                            R.lensProp(data.item.id.toString()), false, prev
                          )
                        )}
                        style={{ color: 'blue', fontSize: 16, marginTop: 20 }}
                      />
                  ) : (
                      <Icon
                        name="chevron-down"
                        onPress={() => setShowDetails(
                          prev => R.set(
                            R.lensProp(data.item.id.toString()), true, prev
                          )
                        )}
                        style={{ color: 'blue', fontSize: 20, marginTop: 20 }}
                      />
                  )
                }
              </View>
              {
                showDetails[data.item.id.toString()]
                ? (
                  <View>
                    <Text onPress={() => { toggleSelectedClaim(data.item) }}>
                      <YamlFormat source={ data.item.claim || data.item } navigation={ navigation } />
                    </Text>
                  </View>
                ) : (
                  <View />
                )
              }
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
                title="Proceed to Sign"
                onPress={ setConfirmations }
              />
            </View>
          }
        />
      </ScrollView>
    </View>
    </SafeAreaView>
  )
}
