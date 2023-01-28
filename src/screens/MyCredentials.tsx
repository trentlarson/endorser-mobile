import * as R from 'ramda'
import React, { useState } from 'react'
import { ActivityIndicator, Button, Dimensions, FlatList, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableHighlight, View } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import Icon from 'react-native-vector-icons/FontAwesome'
import { useSelector } from 'react-redux'

import { styles } from './style'
import * as utility from '../utility/utility'
import { YamlFormat } from '../utility/utility.tsx'
import { appSlice, appStore } from '../veramo/appSlice'
import { agent } from '../veramo/setup'

export function MyCredentialsScreen({ navigation }) {

  const [loadedNumber, setLoadedNumber] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(false)
  const [numStrangesAndUnknowns, setNumStrangesAndUnknowns] = useState<number>(0)
  const [outstandingPerCurrency, setOutstandingPerCurrency] = useState<Record<string,Record>>({})
  const [outstandingPerInvoice, setOutstandingPerInvoice] = useState<Record<string,Record>>({})
  const [paidPerCurrency, setPaidPerCurrency] = useState<Record<string,Record>>({})
  const [quickMessage, setQuickMessage] = useState<string>(null)
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [searchResults, setSearchResults] = useState<any>(null)
  const [showActions, setShowActions] = useState<boolean>(false)
  const [showDetails, setShowDetails] = useState<boolean>(false)
  const [showMore, setShowMore] = useState<boolean>(false)
  const [showSearchInfoModal, setShowSearchInfoModal] = useState<boolean>(false)
  const [totalCurrenciesOutstanding, setTotalCurrenciesOutstanding] = useState<Record<string,number>>({})
  const [totalCurrenciesPaid, setTotalCurrenciesPaid] = useState<Record<string,number>>({})

  const identifiers = useSelector((state) => state.identifiers || [])

  const isUser = did => did === identifiers[0].did

  const removeSchemaContext = obj => obj['@context'] === 'https://schema.org' ? R.omit(['@context'], obj) : obj

  const displayCurrencyLabel = (curr) => (curr === 'HUR' ? 'hours' : curr)

  const displayAmount = (curr, amt) => '' + amt + ' ' + displayCurrencyLabel(curr)

  // Hack because without this it doesn't scroll to the bottom: https://stackoverflow.com/a/67244863/845494
  const screenHeight = Dimensions.get('window').height - 200

  const searchEndorserForString = async () => {
    setLoading(true)
    const endorserApiServer = appStore.getState().settings.apiServer
    const token = await utility.accessToken(identifiers[0])
    const searchParam = searchTerm ? '&claimContents=' + encodeURIComponent(searchTerm) : ''
    fetch(endorserApiServer + '/api/claim?subject=' + identifiers[0].did + searchParam, {
      method: 'GET',
      headers: {
        "Content-Type": "application/json",
        "Uport-Push-Token": token,
      }
    }).then(async response => {
      setLoading(false)
      if (response.status !== 200) {
        const text = await response.text()
        appStore.dispatch(appSlice.actions.addLog({log: true, msg: "Unsuccessful results for personal search. " + text}))
        setQuickMessage('Request error. See logs for more info.')
        setTimeout(() => { setQuickMessage(null) }, 2000)
      } else {
        return response.json()
      }
    }).then(results => {
      setSearchResults(results)
      setNumStrangesAndUnknowns(0)
      setOutstandingPerCurrency({})
      setOutstandingPerInvoice({})
      setPaidPerCurrency({})
      setTotalCurrenciesOutstanding({})
      setTotalCurrenciesPaid({})
    })
  }

  /**
   * return Promise of
   *   jwts: array of JWT objects
   *   hitLimit: boolean telling whether there may be more
   */
  const moreTransactions = async (prevId) => {
    const endorserApiServer = appStore.getState().settings.apiServer
    const token = await utility.accessToken(identifiers[0])
    let maybeMoreBeforeQuery = prevId == null ? '' : '&beforeId=' + prevId
    return fetch(endorserApiServer + '/api/v2/report/claimsForIssuerWithTypes?claimTypes=' + encodeURIComponent(JSON.stringify(["GiveAction","Offer"])) + maybeMoreBeforeQuery, {
      method: 'GET',
      headers: {
        "Content-Type": "application/json",
        "Uport-Push-Token": token,
      }
    }).then(async response => {
      if (response.status !== 200) {
        const text = await response.text()
        appStore.dispatch(appSlice.actions.addLog({log: true, msg: "Unsuccessful result code for personal transactions. " + text}))

        setQuickMessage('Request error. See logs for more info.')
        setTimeout(() => { setQuickMessage(null) }, 2000)
      } else {
        return response.json()
      }
    }).then(results => {
      if (results != null) {
        if (results.data) {
          return results
        } else {
          appStore.dispatch(appSlice.actions.addLog({log: true, msg: "Unsuccessful results for personal transactions: " + JSON.stringify(results)}))
          setQuickMessage('Request error. See logs for more info.')
          setTimeout(() => { setQuickMessage(null) }, 2000)
        }
      }
    })
  }

  const searchEndorserForTransactions = async () => {
    setLoading(true)
    setLoadedNumber(0)
    let allResults: Array<utility.EndorserRecord> = []
    let nextBefore
    do {
      let nextResults = await moreTransactions(nextBefore)
      if (nextResults && nextResults.data) {
        allResults = allResults.concat(nextResults.data)
        setLoadedNumber(allResults.length)
        nextBefore = nextResults.hitLimit ? nextResults.data[nextResults.data.length - 1].id : undefined
      }
    } while (nextBefore)

    setLoading(false)
    const displayResults = R.reverse(allResults) // we will keep the convention of reverse chronological order
    setSearchResults(displayResults)

    const accounting = utility.countTransactions(allResults, identifiers[0].did)
    setTotalCurrenciesOutstanding(accounting.outstandingCurrencyTotals)
    setTotalCurrenciesPaid(accounting.totalCurrencyPaid)
    setNumStrangesAndUnknowns(accounting.idsOfStranges.length + accounting.idsOfUnknowns.length)

    setOutstandingPerInvoice(accounting.outstandingInvoiceTotals)

    let outPerCur = {}
    for (promised of accounting.allPromised) {
      const invoiceNum =
        promised.claim.identifier
        || (promised.claim.recipient && promised.claim.recipient.identifier)
      if (accounting.outstandingInvoiceTotals[invoiceNum] > 0
          // itemOffered is for some legacy Offers in Endorser.ch
          && (promised.claim.includesObject || promised.claim.itemOffered?.unitCode)) {
        let node = promised.claim.includesObject
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

    setSearchTerm('')
  }

  const renderOneItem = (datum: utility.EndorserRecord) => {
    const summary =
      utility.claimSummary(
        datum,
        isUser(datum.issuer) ? '' : ' (issued by someone else)'
      )

    return (
      <View>

        <Text selectable={true}>{ summary }</Text>

        <View style={{ flexDirection: 'row' }}>
          <View style={{ marginLeft: 30 }}>
          {
            datum.claim['@type'] === 'Offer'
            ?
              outstandingPerInvoice[datum.claim.identifier] > 0
              || outstandingPerInvoice[datum.claim.recipient && datum.claim.recipient.identifier] > 0
              ?
                <Text>(Not Fully Paid)</Text>
              :
                outstandingPerInvoice[datum.claim.identifier] === 0
                || outstandingPerInvoice[datum.claim.recipient && datum.claim.recipient.identifier] === 0
                ?
                  <Text>(All Paid)</Text>
                :
                  <Text>(Not A Specific Amount)</Text>
            :
              datum.claim['@type'] === 'GiveAction'
              ?
                <Text>(Paid)</Text>
              :
                <View />
          }
          </View>

          <View style={{ marginLeft: 5 }}>
            {
              showMore
              ?
                <Icon
                  name="chevron-down"
                  onPress={() => setShowMore(prev => !prev)}
                  style={{ color: 'blue' }}
                />
              :
                <Text onPress={() => setShowMore(prev => !prev)}>
                  <Icon name="chevron-right" style={{ color: 'blue' }} />
                  ...
                </Text>
            }
          </View>
        </View>

        {
          showMore
          ?
            <View>
              <View style={{ flexDirection: 'row', padding: 5 }}>
                <Text
                  style={{ color: "blue" }}
                  onPress={() => setShowActions(prev => !prev )}
                >
                   { showActions ? "Hide" : "Show" } Actions
                </Text>
              </View>

              {
                !showActions
                ?
                  <View />
                :
                  <View style={{ flexDirection: 'row' }}>
                  {
                    <Pressable
                      style={{ padding: 10 }}
                      onPress={ () => navigation.navigate('Verify Credential', { wrappedClaim: datum }) }
                    >
                      <Text style={{ color: "blue" }}>Check it</Text>
                    </Pressable>
                  }

                  {
                    <Pressable
                      style={{ padding: 10 }}
                      onPress={ () =>
                        navigation.navigate('Present Credential', { fullClaim: datum })
                      }
                    >
                      <Text style={{ color: "blue" }}>Present it</Text>
                    </Pressable>
                  }

                  {
                    isUser(datum.issuer) && datum.claim['@type'] === 'Offer'
                    ?
                    <View>
                      <Pressable
                        style={{ padding: 10 }}
                        onPress={ () =>
                          navigation.push(utility.REVIEW_SIGN_SCREEN_NAV, {
                            credentialSubject: {
                              "@context": "https://schema.org",
                              "@type": "GiveAction",
                              agent: { identifier: identifiers[0].did },
                              offerId: datum.claim.identifier,
                              recipient: datum.claim.recipient,
                              object: datum.claim.itemOffered || datum.claim.includesObject,
                            }
                          })
                        }
                      >
                        <Text style={{ color: "blue" }}>Mark as given</Text>
                      </Pressable>
                    </View>
                    :
                    <View />
                  }

                  {
                    !isUser(datum.issuer) && datum.claim['@type'] != 'AgreeAction'
                    ?
                      <Pressable
                        style={{ padding: 10 }}
                        onPress={ () =>
                          navigation.push(utility.REVIEW_SIGN_SCREEN_NAV, {
                            credentialSubjects: {
                              "@context": "https://schema.org",
                              "@type": "AgreeAction",
                              object: removeSchemaContext(datum.claim),
                            }
                          })
                        }
                      >
                        <Text style={{ color: "blue" }}>Agree</Text>
                      </Pressable>
                    :
                      <View />
                  }

                  {
                    !isUser(datum.issuer)
                    && (datum.claim['@type'] === 'LoanOrCredit'
                       || datum.claim['@type'] === 'GiveAction')
                    ?
                      <Pressable
                        style={{ padding: 10 }}
                        onPress={ () =>
                          navigation.push(utility.REVIEW_SIGN_SCREEN_NAV, {
                            credentialSubject: {
                              "@context": "https://schema.org",
                              "@type": "TakeAction",
                              agent: { identifier: identifiers[0].did },
                              object: removeSchemaContext(datum.claim),
                            }
                          })
                        }
                      >
                        <Text style={{ color: "blue" }}>Take</Text>
                      </Pressable>
                    :
                      <View />
                  }

                  </View>
              }

              <View style={{ flexDirection: 'row', padding: 5 }}>
                <Text
                  style={{ color: "blue" }}
                  onPress={() => setShowDetails(prev => !prev )}
                >
                  { showDetails ? "Hide" : "Show" } Details
                </Text>
              </View>

              {
                showDetails
                ? <YamlFormat source={ datum } navigation={ navigation } showActions={ showActions } />
                : <View />
              }
            </View>
          :
            <View />
        }

        <View style={styles.line} />
      </View>
    )
  }

  return (
    <SafeAreaView>
      <ScrollView>{/* vertical scrolling */}
        <ScrollView horizontal={ true }>{/* horizontal scrolling for long string values */}

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

                  <Text>
                    Filter (optional)
                    &nbsp;
                    <Icon name="info-circle" onPress={() => setShowSearchInfoModal(true)} />
                  </Text>
                  <Modal
                    animationType="slide"
                    transparent={true}
                    visible={!!showSearchInfoModal}
                  >
                    <View style={styles.centeredView}>
                      <View style={styles.modalView}>
                        <Text>This only retrieves the 50 most recent matches.</Text>
                        <TouchableHighlight
                          onPress={() => {
                            setShowSearchInfoModal(false)
                          }}
                        >
                          <Text>Close</Text>
                        </TouchableHighlight>
                      </View>
                    </View>
                  </Modal>

                  <Modal
                    animationType="slide"
                    transparent={true}
                    visible={!!quickMessage}
                  >
                    <View style={styles.centeredView}>
                      <View style={styles.modalView}>
                        <Text>{ quickMessage }</Text>
                      </View>
                    </View>
                  </Modal>

                  <TextInput
                    autoCapitalize={'none'}
                    value={searchTerm}
                    onChangeText={setSearchTerm}
                    editable
                    style={{ borderWidth: 1 }}
                  />
                  <Button
                    title="Search About You"
                    onPress={searchEndorserForString}
                  />

                  <View style={{ padding: 5 }} />
                  <Button
                    title="Retrieve All Your Transactional Claims"
                    onPress={searchEndorserForTransactions}
                  />

                  <FlatList
                    data={searchResults}
                    keyExtractor={item => item.id.toString()}
                    ItemSeparatorComponent={() => <View style={styles.line} />}
                    ListEmptyComponent={<Text>{ searchResults == null ? "" : "None" }</Text>}
                    ListHeaderComponent={
                      <View>
                        {
                          searchResults != null
                          ? <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 10 }}>Matching Claims</Text>
                          : <Text />
                        }

                        {
                          (R.equals(totalCurrenciesOutstanding, {}))
                          ?
                            <View/>
                          :
                            <View style={{ padding: 10 }}>
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

                        {
                          (numStrangesAndUnknowns > 0)
                          ? <Text>{numStrangesAndUnknowns} of these claims {numStrangesAndUnknowns === 1 ? "does" : "do"} not have specific, measurable info.</Text>
                          : <View />
                        }

                        <View style={styles.line} />
                      </View>
                    }

                    ListFooterComponent={<View style={{ marginBottom: 200}}>{/* Without this, bottom tabs hide the bottom. */}</View>}

                    renderItem={ data => renderOneItem(data.item) }
                  />
                </View>
            }
          </View>

        </ScrollView>
      </ScrollView>
    </SafeAreaView>
  )
}
