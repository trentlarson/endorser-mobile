import * as R from 'ramda'
import React, { useState } from 'react'
import { ActivityIndicator, Button, FlatList, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native'
import { CheckBox } from 'react-native-elements'
import { useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux'

import * as utility from '../utility/utility'
import { RenderOneRecord } from '../utility/utility.tsx'
import { appSlice, appStore, DEFAULT_ENDORSER_API_SERVER, DEFAULT_ENDORSER_VIEW_SERVER } from '../veramo/appSlice'
import { ContactSelectModal } from './ContactSelect'
import { styles } from './style'

export function ReportScreen({ navigation }) {

  const [loadingSearch, setLoadingSearch] = useState<boolean>(false)
  const [confirmLoading, setConfirmLoading] = useState<Array<boolean>>({})
  const [confirms, setConfirms] = useState<Array<number>>({})
  const [searchError, setSearchError] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [searchResults, setSearchResults] = useState<Array<utility.EndorserRecord>>()
  const [selectFromContacts, setSelectFromContacts] = useState<boolean>(false)
  const [showAcceptConfirmations, setShowAcceptConfirmations] = useState<boolean>(false)
  const [showAcceptTotals, setShowAcceptTotals] = useState<boolean>(false)
  const [showAcceptsOnly, setShowAcceptsOnly] = useState<boolean>(false)
  const [showClaimsWithoutDids, setShowClaimsWithoutDids] = useState<boolean>(false)

  const identifiers = useSelector((state) => state.identifiers || [])

  const retrieveConfirms = async (claimId, claimIssuerDid) => {
    setConfirmLoading(conLoad => R.set(R.lensProp(claimId), true, conLoad))

    const url =
      appStore.getState().settings.apiServer
      + '/api/report/issuersWhoClaimedOrConfirmed?claimId='
      + encodeURIComponent(claimId)
    const userToken = await utility.accessToken(identifiers[0])
    await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        "Uport-Push-Token": userToken
    }})
    .then(async response => {
      if (response.status === 200) {
        return response.json()
      } else {
        const bodyText = await response.text()
        throw (
          'While retrieving confirmations, got bad response status of ' + response.status
          + ' and body: ' + bodyText
        )
      }
    })
    .then(result => {
      // result is object with key 'result'
      // ... with value an array of DIDs who confirmed who I can see, potentially some HIDDEN
      if (result.result) {
        // don't include confirmations by this person
        const resultOthers = R.reject(did => did === claimIssuerDid, result.result)
        setConfirms(cons => R.set(R.lensProp(claimId), resultOthers.length, cons))
      } else {
        throw ('While retrieving confirmations, got bad result: ' + JSON.stringify(result))
      }
    })
    .catch(err => {
      appStore.dispatch(appSlice.actions.addLog({log: true, msg: "Problem accessing confirmation data: " + err}))
      setSearchError('Could not access confirmation data. See logs.')
    })
    .finally(() => {
      setConfirmLoading(conLoad => R.set(R.lensProp(claimId), false, conLoad))
    })
  }

  // return list component for the text of all AcceptAction claims
  const AcceptList = ({acceptRecords}) => {
    // 'acceptRecords' is array of utility.EndorserRecord
    return (
      <View>
        {
          acceptRecords.map(accept => (
            <View style={{ borderWidth: 1, flex: 1, flexDirection: 'row' }} key={accept.id}>
              <Text style={{ padding: 10, width: "80%" }}>{ accept.claim.object }</Text>
              <View style={{ flex: 1, flexDirection: 'column', justifyContent: 'center', padding: 5, width: '20%' }}>
              {
                confirmLoading[accept.id]
                ?
                  <ActivityIndicator color="#00ff00" />
                :
                  confirms[accept.id] != null
                  ?
                    <Text style={{ textAlign: 'center' }}>{confirms[accept.id]}</Text>
                  :
                    <Text
                      onPress={() => retrieveConfirms(accept.id, accept.issuer) }
                      style={{ color: 'blue', textAlign: 'center' }}
                    >
                      Load Confirms
                    </Text>
              }
              </View>
            </View>
          ))
        }
      </View>
    )
  }

  // return list component for the text of all AcceptAction claims
  const AcceptAggregateList = ({acceptRecords}) => {
    // 'acceptRecords' is array of utility.EndorserRecord
    const pledgesByPledge = R.groupBy(rec => rec.claim.object, acceptRecords)
    const pledgeArrays = R.sortBy(arr => -arr.length, R.values(pledgesByPledge))
    return (
      <View>
        <Text>Note that these are only from the most recent pledges.</Text>
        {
          pledgeArrays.map(pledges => (
            <View style={{ borderWidth: 1, flex: 1, flexDirection: 'row' }} key={pledges[0].claim.object}>
              <Text style={{ padding: 10, width: "90%" }}>{ pledges[0].claim.object }</Text>
              <View style={{ flex: 1, flexDirection: 'column', justifyContent: 'center', padding: 5, width: '10%' }}>
                <Text style={{ textAlign: 'center' }}>{"" + pledges.length}</Text>
              </View>
            </View>
          ))
        }
      </View>
    )
  }

  const filteredResultOutput = (results) => {
    // assuming results is an array
    const filteredResults0 =
      showClaimsWithoutDids
      ? results
      : R.filter(utility.containsNonHiddenDid, results)
    const filteredResults1 =
      showAcceptsOnly
      ? R.filter(full => utility.isAccept(full.claim) && typeof full.claim.object == 'string', filteredResults0)
      : filteredResults0
    if (results.length > 0 && filteredResults1.length === 0) {
      return (
        <Text>There are results but they include IDs not visible. (Use checkboxes to show more claims.)</Text>
      )
    } else if (showAcceptsOnly && showAcceptConfirmations) {
      return <AcceptList acceptRecords={filteredResults1} />
    } else if (showAcceptsOnly && showAcceptTotals) {
      return <AcceptAggregateList acceptRecords={filteredResults1} />
    } else {
      return (
        /* horizontal scrolling for actions & long string values */
        <ScrollView horizontal={true}>
          <FlatList
            data={filteredResults1}
            scrollEnabled={false} /* somehow this allows both Android & iOS to scroll */
            /* fixed height makes iOS vertical scroll but stops Android from scrolling */
            style={{ borderWidth: 1 }}
            ListHeaderComponent={
              <Text style={{ padding: 10 }}>(Only retrieved the 50 most recent matching claims.)</Text>
            }
            renderItem={datum =>
              <RenderOneRecord
                source={ datum.item }
                navigation={ navigation }
                afterItemCss={ styles.line }
              />
            }
          >
          </FlatList>
        </ScrollView>
      )
    }
  }

  const searchEndorser = async (param) => {

    let urlSuffix
    let oneResult = false
    if (param.claimId != null) {
      urlSuffix = '/' + encodeURIComponent(param.claimId)
      oneResult = true
    } else if (param.searchClaimType != null) {
      urlSuffix = '?claimType=' + encodeURIComponent(param.searchClaimType)
    } else if (param.searchTerm != null) {
      urlSuffix = '?claimContents=' + encodeURIComponent(param.searchTerm)
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
      }).then(async response => {
        setLoadingSearch(false)
        if (response.status !== 200) {
          const bodyText = await response.text()
          throw Error('There was an error from the server with code ' + response.status + ' and body: ' + bodyText)
        }
        return response.json()
      }).then(result => {
        let correctResults = oneResult ? [result] : result
        setSearchResults(correctResults)
        setSearchError('')
      }).catch(err => {
        setLoadingSearch(false)
        appStore.dispatch(appSlice.actions.addLog({
          log: true,
          msg: "Problem during search at " + appStore.getState().settings.apiServer
             + '/api/claim' + urlSuffix + " Error: " + err}
        ))
        setSearchError('There was a problem searching. See logs for more info.')
      })
    } else {
      console.log('The call to searchEndorser needs claimId or searchClaimType or searchTerm in param, but got', param)
      setSearchError('No search criteria was supplied.')
    }
  }

  return (
    <SafeAreaView>
      <ScrollView>{/* vertical scrolling */}
        <View style={{ padding: 20 }}>
          <View style={{ marginTop: 20 }} />
          <Text style={{ fontSize: 30, fontWeight: 'bold' }}>All
            {
              (appStore.getState().settings.apiServer !== DEFAULT_ENDORSER_API_SERVER
               || appStore.getState().viewServer !== DEFAULT_ENDORSER_VIEW_SERVER)
               ? " - Custom Servers"
               : ""
            }
          </Text>

          {
            loadingSearch
            ?
              <ActivityIndicator color="#00ff00" />
            :
              <View>
                {
                  searchResults == null
                  ?
                    <View>

                      <TextInput
                        autoCapitalize={'none'}
                        value={searchTerm}
                        onChangeText={setSearchTerm}
                        editable
                        style={{ borderWidth: 1 }}
                      />
                      <Text style={{ marginTop: 10 }}>
                        Examples:&nbsp;
                        <Text style={{ color: 'blue' }} onPress={() => {
                          setSearchTerm('programming')
                          searchEndorser({ searchTerm: 'programming'})
                        }}>programming</Text>,&nbsp;
                        <Text style={{ color: 'blue' }} onPress={() => {
                          setSearchTerm('Training')
                          searchEndorser({ searchTerm: 'Training'})
                        }}>Training</Text>,&nbsp;
                        <Text style={{ color: 'blue' }} onPress={() => {
                          setSearchTerm('PlanAction')
                          searchEndorser({ searchTerm: 'PlanAction'})
                        }}>PlanAction</Text>
                      </Text>
                      <View style={{ marginTop: 10 }} />
                      <View style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text>
                          <Text style={{ color: 'blue' }} onPress={() => {
                            searchEndorser({ searchClaimType: 'PlanAction'})
                          }}>Show Plans & Projects</Text>
                        </Text>
                        <Text>
                          <Text style={{ color: 'blue' }} onPress={() => {
                            setSelectFromContacts(true) }}
                          >
                            Select a Contact
                          </Text>
                        </Text>
                      </View>

                      <Button
                        title="Search"
                        onPress={() => searchEndorser({ searchTerm: searchTerm })}
                      />

                      {
                        identifiers.length > 0
                        ?
                          <View style={{ marginTop: 20 }} >
                            <Text style={{ fontSize: 30, fontWeight: 'bold' }}>Search Only Yours</Text>
                            <Button
                              title="Search..."
                              onPress={() => navigation.navigate('Your Credentials')}
                            />
                          </View>
                        :
                          <View/>
                      }

                    </View>
                  :
                    <View>
                      <Button
                        title="Reset"
                        onPress={() => setSearchResults(null)}
                      />
                    </View>
                }
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

                {
                  searchResults != null
                  ? searchResults.length == 0
                    ? <Text>No results.</Text>
                    : <View>
                        <CheckBox
                          title='Show claims without visible IDs.'
                          checked={showClaimsWithoutDids}
                          onPress={() => setShowClaimsWithoutDids(!showClaimsWithoutDids)}
                        />
                        <CheckBox
                          title='Show only accepted pledges.'
                          checked={showAcceptsOnly}
                          onPress={() => {
                            setShowAcceptsOnly(!showAcceptsOnly)
                            setShowAcceptConfirmations(false)
                            setShowAcceptTotals(false)
                          }}
                        />
                        <Button
                          title="Find a Common Contact for These"
                          onPress={() =>
                            navigation.navigate(
                              'Contacts',
                              {
                                screen: "Contact Correlate Choices",
                                params: { claims: searchResults }
                              }
                            )
                          }
                        />
                        {
                          showAcceptsOnly
                          ?
                            <View style={{ marginLeft: 30 }}>
                              <CheckBox
                                title='Show confirmations of pledges.'
                                checked={showAcceptConfirmations}
                                onPress={() => {
                                  setShowAcceptConfirmations(!showAcceptConfirmations)
                                  setShowAcceptTotals(false)
                                }}
                              />
                              <CheckBox
                                title='Show most popular pledges.'
                                checked={showAcceptTotals}
                                onPress={() => {
                                  setShowAcceptTotals(!showAcceptTotals)
                                  setShowAcceptConfirmations(false)
                                }}
                              />
                            </View>
                          :
                            <View />
                        }

                        <View>
                          { filteredResultOutput(searchResults) }
                        </View>
                      </View>
                    :
                      <View />
                }
              </View>
          }

        </View>

        {
          selectFromContacts
          ? <ContactSelectModal
              cancel={ () => { setSelectFromContacts(false) } }
              proceed={ (did) => {
                setSelectFromContacts(false)
                setSearchTerm(did);
                searchEndorser({ searchTerm: did })
              }}
          />
          : <View/>
        }

      </ScrollView>
    </SafeAreaView>
  )
}
