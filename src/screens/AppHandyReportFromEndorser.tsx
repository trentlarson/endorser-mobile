import * as R from 'ramda'
import React, { useState } from 'react'
import { ActivityIndicator, Button, FlatList, Item, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native'
import { CheckBox } from 'react-native-elements'
import { useSelector } from 'react-redux'

import { styles } from './style'
import * as utility from '../utility/utility'
import { YamlFormat } from '../utility/utility.tsx'
import { appSlice, appStore, DEFAULT_ENDORSER_API_SERVER, DEFAULT_ENDORSER_VIEW_SERVER } from '../veramo/appSlice'

export function AppHandyReportScreen({ navigation }) {

  const [loadingSearch, setLoadingSearch] = useState<boolean>(false)
  const [searchError, setSearchError] = useState<string>('')
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
    if (results.length > 0 && filteredResults.length === 0) {
      return <Text>There are contracts but they include unknown entities.</Text>
    } else {
      return <YamlFormat source={ filteredResults } navigation={navigation} afterItemCss={styles.line} />
    }
  }

  const searchEndorser = async (param) => {

    let urlSuffix
    let oneResult = false
    if (param.searchTerm != null) {
      urlSuffix = '?claimType=Contract&claimContents=' + encodeURIComponent(param.searchTerm)
    } else if (param.claimId != null) {
      urlSuffix = '/' + encodeURIComponent(param.claimId)
      oneResult = true
    }

    if (urlSuffix) {
      setLoadingSearch(true)
      const token = await utility.accessToken(identifiers[0])
      fetch(appStore.getState().settings.apiServer + '/api/claim' + urlSuffix, {
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
        setSearchError('')
      }).catch(err => {
        console.log(err)
        setSearchError('There was a problem searching.')
      })
      
    } else {
      console.log('The call to searchEndorser needs searchTerm or claimId in param, but got', param)
    }
  }

  return (
    <SafeAreaView>
      <ScrollView horizontal={ true }>{/* horizontal scrolling for long string values */}
        <ScrollView>{/* vertical scrolling */}
          <View style={{ padding: 20 }}>
            <View style={{ marginTop: 20 }} />
            <Text style={{ fontSize: 30, fontWeight: 'bold' }}>Search
              {
                (appStore.getState().settings.apiServer !== DEFAULT_ENDORSER_API_SERVER
                 || appStore.getState().viewServer !== DEFAULT_ENDORSER_VIEW_SERVER)
                 ? " - Custom Servers"
                 : ""
              }
            </Text>
            <TextInput
              autoCapitalize={'none'}
              value={searchTerm}
              onChangeText={setSearchTerm}
              editable
              style={{ borderWidth: 1 }}
            />
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
                  <Text style={{ color: 'red' }}>{searchError}</Text>

                  <Text style={{ padding: 10 }}>(Only retrieves the 50 most recent matching contracts.)</Text>

                  {
                    searchResults == null
                    ? <Text/>
                    : searchResults.length == 0
                      ? <Text>No results.</Text>
                      : <View>
                          <CheckBox
                            title='Show contracts without known entities.'
                            checked={showClaimsWithoutDids}
                            onPress={() => setShowClaimsWithoutDids(!showClaimsWithoutDids)}
                          />
                          
                          { filteredResultOutput(searchResults) }
                        </View>
                  }
                </View>
            }
          </View>
        </ScrollView>
      </ScrollView>
    </SafeAreaView>
  )
}
