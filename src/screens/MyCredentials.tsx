import * as R from 'ramda'
import React, { useState } from 'react'
import { ActivityIndicator, Button, Dimensions, FlatList, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { useSelector } from 'react-redux'

import { styles } from './style'
import * as utility from '../utility/utility'
import { appSlice, appStore } from '../veramo/appSlice'
import { agent } from '../veramo/setup'

export function MyCredentialsScreen({ navigation }) {

  const [loadedNumber, setLoadedNumber] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(false)
  const [outstandingPerCurrency, setOutstandingPerCurrency] = useState<Record<string,Record>>({})
  const [paidPerCurrency, setPaidPerCurrency] = useState<Record<string,Record>>({})
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [searchResults, setSearchResults] = useState()
  const [totalCurrenciesOutstanding, setTotalCurrenciesOutstanding] = useState<Record<string,number>>({})
  const [totalCurrenciesPaid, setTotalCurrenciesPaid] = useState<Record<string,number>>({})

  const identifiers = useSelector((state) => state.identifiers || [])

  const searchEndorserForString = async () => {
    setLoading(true)
    const endorserApiServer = appStore.getState().apiServer
    const token = await utility.accessToken(identifiers[0])
    const searchParam = searchTerm ? '&claimContents=' + encodeURIComponent(searchTerm) : ''
    fetch(endorserApiServer + '/api/claim?subject=' + identifiers[0].did + searchParam, {
      method: 'GET',
      headers: {
        "Content-Type": "application/json",
        "Uport-Push-Token": token,
      }
    }).then(response => {
      setLoading(false)
      if (response.status !== 200) {
        throw Error('There was an error from the server.')
      }
      return response.json()
    }).then(results => {
      setSearchResults(results)
    })
  }

  /**
   * return Promise of
   *   jwts: array of JWT objects
   *   maybeMore: boolean telling whether there may be more
   */
  const moreTransactions = async (prevId) => {
    const endorserApiServer = appStore.getState().apiServer
    const token = await utility.accessToken(identifiers[0])
    let maybeMoreAfterQuery = prevId == null ? '' : '&afterId=' + prevId
    return fetch(endorserApiServer + '/api/reportAll/claimsForIssuerWithTypes?claimTypes=' + encodeURIComponent(JSON.stringify(["GiveAction","Offer"]) + maybeMoreAfterQuery), {
      method: 'GET',
      headers: {
        "Content-Type": "application/json",
        "Uport-Push-Token": token,
      }
    }).then(response => {
      if (response.status !== 200) {
        throw Error('There was a low-level error from the server.')
      }
      return response.json()
    }).then(results => {
      if (results.data) {
        return results
      } else {
        appStore.dispatch(appSlice.actions.addLog({log: true, msg: "Unsuccessful results for searchEndorserForTransactions: " + JSON.stringify(results)}))
        throw Error(results.error || 'The server got an error. (For details, see the log on the Settings page.)')
      }
    })
  }

  const searchEndorserForTransactions = async () => {
    setLoading(true)
    setLoadedNumber(0)
    let allResults = []
    let maybeMoreAfter
    do {
      let nextResults = await moreTransactions(maybeMoreAfter)
      if (nextResults.data) {
        allResults = allResults.concat(nextResults.data)
        setLoadedNumber(allResults.length)
        maybeMoreAfter = nextResults.maybeMoreAfter
      }
    } while (maybeMoreAfter)

    setLoading(false)
    setSearchResults(allResults)

    const accounting = utility.countTransactions(allResults, identifiers[0].did)
    setTotalCurrenciesOutstanding(accounting.outstandingCurrencyTotals)
    setTotalCurrenciesPaid(accounting.totalCurrencyPaid)
    if (accounting.numUnknowns > 0) {
      appStore.dispatch(appSlice.actions.addLog({log: true, msg: 'Got ' + accounting.numUnknowns + ' transactions that were not formatted right.'}))
    }

    let outPerCur = {}
    for (promised of accounting.allPromised) {
      const invoiceNum =
        promised.claim.identifier
        || (promised.claim.recipient && promised.claim.recipient.identifier)
      if (accounting.outstandingInvoiceTotals[invoiceNum] > 0
          && promised.claim.itemOffered) {
        let node = promised.claim.itemOffered
        outPerCur[node.unitCode] = (outPerCur[node.unitCode] || []).concat([promised])
      }
    }
    setOutstandingPerCurrency(outPerCur)

    let paidPerCur = {}
    for (paid of accounting.allPaid) {
      if (paid.claim.object) {
        let node = paid.claim.object
        paidPerCur[node.unitCode] = (paidPerCur[node.unitCode] || []).concat([paid])
      }
    }
    setPaidPerCurrency(paidPerCur)
  }

  const isUser = did => did === identifiers[0].did

  const removeSchemaContext = obj => obj['@context'] === 'https://schema.org' ? R.omit(['@context'], obj) : obj

  const displayCurrencyLabel = (curr) => (curr === 'HUR' ? 'hours' : curr)

  const displayAmount = (curr, amt) => '' + amt + ' ' + displayCurrencyLabel(curr)

  // Hack because without this it doesn't scroll to the bottom: https://stackoverflow.com/a/67244863/845494
  const screenHeight = Dimensions.get('window').height - 200

  return (
    <SafeAreaView>
      <View style={{ padding: 20, height: screenHeight }}>
        <Text style={{ fontSize: 30, fontWeight: 'bold' }}>Search</Text>
        {
          loading
          ?
            <View>
              <Text>Loaded { loadedNumber }...</Text>
              <ActivityIndicator color="#00FF00" />
            </View>
          :
            <View>
              <Text>Filter (optional)</Text>
              <TextInput
                autoCapitalize={'none'}
                value={searchTerm}
                onChangeText={setSearchTerm}
                editable
                style={{ borderWidth: 1 }}
              />
              <Button
                title="Search For Filter"
                onPress={searchEndorserForString}
              />
              <Button
                title="Search For Transactional Claims"
                onPress={searchEndorserForTransactions}
              />
              <FlatList
                data={searchResults}
                keyExtractor={item => item.id.toString()}
                ItemSeparatorComponent={() => <View style={styles.line} />}
                ListEmptyComponent={<Text>None</Text>}
                ListHeaderComponent={
                  <View>
                    <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 10 }}>Matching Claims</Text>
                    {
                      (R.equals(totalCurrenciesOutstanding, {}))
                      ? <View/>
                      :
                        <View>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-evenly' }}>
                            <Text>Total Outstanding Offers</Text>
                            {
                              R.map(
                                arr =>
                                  <Text
                                    key={arr[0]}
                                    style={{ color: 'blue' }}
                                    onPress={ () =>
                                      navigation.navigate(
                                        'Your Offers',
                                        {
                                          currencyLabel: displayCurrencyLabel(arr[0]),
                                          offerList: outstandingPerCurrency[arr[0]],
                                        }
                                      )
                                    }
                                  >
                                    {displayAmount(arr[0], arr[1])}
                                  </Text>,
                                R.toPairs(totalCurrenciesOutstanding)
                              )
                            }
                          </View>
                        </View>
                    }
                    {
                      (R.equals(totalCurrenciesPaid, {}))
                      ? <View/>
                      :
                        <View>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-evenly' }}>
                            <Text>Total Paid</Text>
                            {
                              R.map(
                                arr =>
                                  <Text
                                    key={arr[0]}
                                    style={{ color: 'blue' }}
                                    onPress={ () =>
                                      navigation.navigate(
                                        'Your Given',
                                        {
                                          currencyLabel: displayCurrencyLabel(arr[0]),
                                          givenList: paidPerCurrency[arr[0]],
                                        }
                                      )
                                    }
                                  >
                                    {displayAmount(arr[0], arr[1])}
                                  </Text>,
                                R.toPairs(totalCurrenciesPaid)
                              )
                            }
                          </View>
                        </View>
                    }
                    <View style={styles.line} />
                  </View>
                }
                renderItem={data =>
                  <View>

                    <Text selectable={true}>{
                      utility.claimDescription(
                        data.item,
                        identifiers,
                        appStore.getState().contacts || [],
                        isUser(data.item.issuer) ? '' : ' (issued by a someone else)'
                      )
                    }</Text>

                    <View style={{ flexDirection: 'row' }}>
                      {
                        isUser(data.item.issuer)
                        ?
                          <Pressable
                            style={{ padding: 10 }}
                            onPress={ () =>
                              navigation.navigate('Present Credential', { fullClaim: data.item })
                            }
                          >
                            <Text style={{ color: "blue" }}>Present it</Text>
                          </Pressable>
                        : <View/>
                      }

                      {
                        isUser(data.item.issuer) && data.item.claim['@type'] === 'Offer'
                        ?
                          <Pressable
                            style={{ padding: 10 }}
                            onPress={ () =>
                              navigation.navigate('Sign Credential', {
                                credentialSubject: {
                                  "@context": "https://schema.org",
                                  "@type": "GiveAction",
                                  agent: { identifier: identifiers[0].did },
                                  offerId: data.item.claim.identifier,
                                  recipient: data.item.claim.recipient,
                                  object: data.item.claim.itemOffered,
                                }
                              })
                            }
                          >
                            <Text style={{ color: "blue" }}>Mark as given</Text>
                          </Pressable>
                        : <View/>
                      }

                      {
                        !isUser(data.item.issuer) && data.item.claim['@type'] != 'AgreeAction'
                        ?
                          <Pressable
                            style={{ padding: 10 }}
                            onPress={ () =>
                              navigation.navigate('Sign Credential', {
                                credentialSubject: {
                                  "@context": "https://schema.org",
                                  "@type": "AgreeAction",
                                  object: removeSchemaContext(data.item.claim),
                                }
                              })
                            }
                          >
                            <Text style={{ color: "blue" }}>Agree</Text>
                          </Pressable>
                        :
                          <View/>
                      }

                      {
                        !isUser(data.item.issuer)
                        && (data.item.claim['@type'] === 'LoanOrCredit'
                            || data.item.claim['@type'] === 'GiveAction')
                        ?
                          <Pressable
                            style={{ padding: 10 }}
                            onPress={ () =>
                              navigation.navigate('Sign Credential', {
                                credentialSubject: {
                                  "@context": "https://schema.org",
                                  "@type": "TakeAction",
                                  agent: { identifier: identifiers[0].did },
                                  object: removeSchemaContext(data.item.claim),
                                }
                              })
                            }
                          >
                            <Text style={{ color: "blue" }}>Take</Text>
                          </Pressable>
                        :
                          <View/>
                      }

                    </View>

                    <View style={styles.line} />
                  </View>
                }
                ListFooterComponent={<View style={styles.line} />}
              />
            </View>
        }
      </View>
    </SafeAreaView>
  )
}
