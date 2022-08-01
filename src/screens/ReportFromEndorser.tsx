import { classToPlain } from 'class-transformer'
import * as R from 'ramda'
import React, { useState } from 'react'
import { ActivityIndicator, Button, FlatList, Item, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native'
import { CheckBox } from 'react-native-elements'
import { useFocusEffect } from '@react-navigation/native'
import { useSelector } from 'react-redux'

import { styles } from './style'
import { MASTER_COLUMN_VALUE, Settings } from "../entity/settings"
import * as utility from '../utility/utility'
import { YamlFormat } from '../utility/utility.tsx'
import { appSlice, appStore, DEFAULT_ENDORSER_API_SERVER, DEFAULT_ENDORSER_VIEW_SERVER } from '../veramo/appSlice'
import { dbConnection } from "../veramo/setup"

export function ReportScreen({ navigation }) {

  const [feedData, setFeedData] = useState<utility.EndorserRecord>([])
  const [feedError, setFeedError] = useState<string>()
  const [feedHitLimit, setFeedHitLimit] = useState<boolean>(false)
  const [feedPreviousLastId, setFeedPreviousLastId] = useState<string>(appStore.getState().settings.lastViewedClaimId)
  const [todaysOldestFeedId, setTodaysOldestFeedId] = useState<string>()
  const [loadingRecent, setLoadingRecent] = useState<boolean>(true)
  const [loadingSearch, setLoadingSearch] = useState<boolean>(false)
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [searchResults, setSearchResults] = useState()
  const [showClaimsWithoutDids, setShowClaimsWithoutDids] = useState(false)

  const identifiers = useSelector((state) => state.identifiers || [])

  const filteredResultOutput = (results) => {
    // assuming results is an array
    const filteredResults =
      showClaimsWithoutDids
      ? results
      : R.filter(utility.containsNonHiddenDid, results)
    return <YamlFormat source={ filteredResults } navigation={navigation} afterItemCss={styles.line} />
  }

  const searchEndorser = async (param) => {

    let urlSuffix
    let oneResult = false
    if (param.searchTerm != null) {
      urlSuffix = '?claimContents=' + encodeURIComponent(param.searchTerm)
    } else if (param.claimId != null) {
      urlSuffix = '/' + encodeURIComponent(param.claimId)
      oneResult = true
    }

    if (urlSuffix) {
      setLoadingSearch(true)
      const token = await utility.accessToken(identifiers[0])
      fetch(appStore.getState().apiServer + '/api/claim' + urlSuffix, {
        method: 'GET',
        headers: {
          "Content-Type": "application/json",
          "Uport-Push-Token": token,
        }
      }).then(response => {
        setLoadingSearch(false)
        if (response.status !== 200) {
          throw Error('There was an error from the server.')
        }
        return response.json()
      }).then(result => {
        let correctResults = oneResult ? [result] : result
        setSearchResults(correctResults)
      })
    } else {
      console.log('The call to searchEndorser needs searchTerm or claimId in param, but got', param)
    }
  }

  const updateFeed = async () => {
    setLoadingRecent(true)

    await utility.retrieveClaims(appStore.getState().apiServer, identifiers[0], feedPreviousLastId, todaysOldestFeedId)
    .then(async results => {
      if (results.data.length > 0) {
        setFeedData(previousData => previousData.concat(results.data))
        setFeedHitLimit(results.hitLimit)
        setTodaysOldestFeedId(results.data[results.data.length - 1].id)

        newLastViewedId = results.data[0].id
        const settings = classToPlain(appStore.getState().settings)
        if (!settings.lastViewedClaimId
            || newLastViewedId > settings.lastViewedClaimId) {
          const conn = await dbConnection
          await conn.manager.update(Settings, MASTER_COLUMN_VALUE, { lastNotifiedClaimId: newLastViewedId, lastViewedClaimId: newLastViewedId })

          settings.lastNotifiedClaimId = newLastViewedId
          settings.lastViewedClaimId = newLastViewedId
          appStore.dispatch(appSlice.actions.setSettings(settings))
        }

      }
    })
    .catch(e => {
      console.log('Error with feed', e)
      setFeedError('Got error retrieving feed data.')
    })

    setLoadingRecent(false)
  }

  useFocusEffect(
    React.useCallback(() => {
      updateFeed()
    }, [])
  )

  return (
    <SafeAreaView>
      <View style={{ padding: 20 }}>
        <Text style={{ fontSize: 30, fontWeight: 'bold' }}>Recent
          {
            (appStore.getState().apiServer !== DEFAULT_ENDORSER_API_SERVER
             || appStore.getState().viewServer !== DEFAULT_ENDORSER_VIEW_SERVER)
             ? " - Custom Servers"
             : ""
          }
        </Text>
        <Text style={{ color: 'red' }}>{feedError}</Text>
        <FlatList
          data={ feedData }
          keyExtractor={ item => item.id }
          initialNumToRender={ 10 }
          renderItem={ data => (
            <YamlFormat source={ data.item } />
          )}
          style={{ borderWidth: 1, height: feedData.length > 0 ? 300 : 60 }}
          ListFooterComponent={(
            <View>
              <ActivityIndicator color="#00ff00" animating={ loadingRecent }/>
              <View style={{ display: (loadingRecent ? "none" : "flex")}}>
                <View style={{ display: (feedHitLimit ? "flex" : "none")}}>
                  <Button
                    title="Load More"
                    onPress={ updateFeed }
                  />
                </View>
                <View style={{ display: (feedHitLimit ? "none" : "flex")}}>
                  <Text>
                    You're all caught up.
                  </Text>
                </View>
              </View>
            </View>
          )}
        />
      </View>
      <ScrollView horizontal={ true }>{/* horizontal scrolling for long string values */}
        <ScrollView>{/* vertical scrolling */}
          <View style={{ padding: 20 }}>
            <View style={{ marginTop: 20 }} />
            <Text style={{ fontSize: 30, fontWeight: 'bold' }}>Search All</Text>
            <TextInput
              autoCapitalize={'none'}
              value={searchTerm}
              onChangeText={setSearchTerm}
              editable
              style={{ borderWidth: 1 }}
            />
            <Text>
              Examples:&nbsp;
              <Text style={{ color: 'blue' }} onPress={() => { setSearchTerm('programming') }}>programming</Text>,&nbsp;
              <Text style={{ color: 'blue' }} onPress={() => { setSearchTerm('Training') }}>Training</Text>,&nbsp;
              <Text style={{ color: 'blue' }} onPress={() => { setSearchTerm('JoinAction') }}>JoinAction</Text>
            </Text>
            {
              loadingSearch
              ?
                <ActivityIndicator color="#00ff00" />
              :
                <View>
                  <Button
                    title="Search"
                    onPress={() => searchEndorser({ searchTerm: searchTerm })}
                  />
                  {
                    searchTerm && searchTerm.length === 26
                    ?
                      <Button
                        title="Find by ID"
                        onPress={() => searchEndorser({ claimId: searchTerm })}
                      />
                    :
                      <View />
                  }
                  <Text style={{ padding: 10 }}>(Only retrieves the 50 most recent matching claims.)</Text>

                  {
                    searchResults == null
                    ? <Text/>
                    : searchResults.length == 0
                      ? <Text>No results.</Text>
                      : <View>
                          <CheckBox
                            title='Show claims without visible IDs.'
                            checked={showClaimsWithoutDids}
                            onPress={() => setShowClaimsWithoutDids(!showClaimsWithoutDids)}
                          />
                          
                          { filteredResultOutput(searchResults) }
                        </View>
                  }
                </View>
            }
          </View>
          { identifiers.length > 0
            ?
              <View style={{ padding: 20 }}>
                <Text style={{ fontSize: 30, fontWeight: 'bold' }}>Search Yours</Text>
                <Button
                  title="Search"
                  onPress={() => navigation.navigate('Your Credentials')}
                />
              </View>
            :
              <View/>
          }
        </ScrollView>
      </ScrollView>
    </SafeAreaView>
  )
}
