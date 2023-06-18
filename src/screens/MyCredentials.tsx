import * as R from 'ramda'
import React, { useState } from 'react'
import { ActivityIndicator, Button, Dimensions, FlatList, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableHighlight, View } from 'react-native'
import Icon from 'react-native-vector-icons/FontAwesome'
import { useSelector } from 'react-redux'

import { styles } from './style'
import * as utility from '../utility/utility'
import { RenderOneRecord, YamlFormat } from '../utility/utility.tsx'
import { appSlice, appStore } from '../veramo/appSlice'

export function MyCredentialsScreen({ navigation }) {

  const [currencyEntriesOutstanding, setCurrencyEntriesOutstanding] = useState<Record<String,Array<any>>>({})
  const [currencyEntriesPaid, setCurrencyEntriesPaid] = useState<Record<String,Array<any>>>({})
  const [loadedNumber, setLoadedNumber] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(false)
  const [numStrangesAndUnknowns, setNumStrangesAndUnknowns] = useState<number>(0)
  const [maybeMore, setMaybeMore] = useState<boolean>(false)
  const [outstandingPerInvoice, setOutstandingPerInvoice] = useState<Record<string,Record>>({})
  const [quickMessage, setQuickMessage] = useState<string>(null)
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [searchResults, setSearchResults] = useState<Array<any>>(null)
  const [showSearchInfoModal, setShowSearchInfoModal] = useState<boolean>(false)
  const [totalCurrenciesOutstanding, setTotalCurrenciesOutstanding] = useState<Record<string,number>>({})
  const [totalCurrenciesPaid, setTotalCurrenciesPaid] = useState<Record<string,number>>({})

  const identifiers = useSelector((state) => state.identifiers || [])

  // Hack because without this it doesn't scroll to the bottom: https://stackoverflow.com/a/67244863/845494
  const screenHeight = Dimensions.get('window').height - 200

  const searchEndorserForString = async () => {
    setLoading(true)
    setLoadedNumber(0)
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
      setMaybeMore(true)

      setCurrencyEntriesOutstanding({})
      setCurrencyEntriesPaid({})
      setNumStrangesAndUnknowns(0)
      setOutstandingPerInvoice({})
      setTotalCurrenciesOutstanding({})
      setTotalCurrenciesPaid({})
    }).catch(e => {
      appStore.dispatch(appSlice.actions.addLog({
        log: true,
        msg: "Unsuccessful search for personal transactions. " + JSON.stringify(e)
      }))

      setQuickMessage('Request error. See logs for more info.')
      setTimeout(() => {
        setQuickMessage(null)
      }, 2000)
    })
  }

  /**
   * return Promise of
   *   data: array of JWT objects
   *   hitLimit: boolean telling whether there may be more
   */
  const moreTransactions = async (prevId) => {
    const endorserApiServer = appStore.getState().settings.apiServer
    const token = await utility.accessToken(identifiers[0])
    let maybeMoreBeforeQuery = prevId == null ? '' : '&beforeId=' + prevId
    return fetch(
      endorserApiServer
        + '/api/v2/report/claimsForIssuerWithTypes?claimTypes='
        + encodeURIComponent(JSON.stringify(["GiveAction","Offer"]))
        + maybeMoreBeforeQuery,
      {
        method: 'GET',
        headers: {
          "Content-Type": "application/json",
          "Uport-Push-Token": token,
        }
      }
    ).then(async response => {
      if (response.status !== 200) {
        const text = await response.text()
        appStore.dispatch(appSlice.actions.addLog({
          log: true,
          msg: "Unsuccessful result code for personal Give & Offer types. " + text
        }))

        setQuickMessage('Request status error. See logs for more info.')
        setTimeout(() => { setQuickMessage(null) }, 2000)
      } else {
        return response.json()
      }
    }).then(results => {
      if (results != null) {
        if (results.data) {
          return results
        } else {
          appStore.dispatch(appSlice.actions.addLog({
            log: true,
            msg: "Unsuccessful results for personal Give & Offer types: " + JSON.stringify(results)
          }))
          setQuickMessage('Request results error. See logs for more info.')
          setTimeout(() => { setQuickMessage(null) }, 2000)
        }
      }
    }).catch(e => {
      appStore.dispatch(appSlice.actions.addLog({
        log: true,
        msg: "Unsuccessful request for personal Give & Offer types. " + JSON.stringify(e)
      }))

      setQuickMessage('Request error. See logs for more info.')
      setTimeout(() => { setQuickMessage(null) }, 2000)
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
    setMaybeMore(false)

    const accounting = utility.countTransactions(allResults, identifiers[0].did)
    setCurrencyEntriesOutstanding(accounting.outstandingCurrencyEntries)
    setCurrencyEntriesPaid(accounting.paidCurrencyEntries)
    setTotalCurrenciesOutstanding(accounting.outstandingCurrencyTotals)
    setTotalCurrenciesPaid(accounting.totalCurrencyPaid)
    setNumStrangesAndUnknowns(accounting.idsOfStranges.length + accounting.idsOfUnknowns.length)
    setOutstandingPerInvoice(accounting.outstandingInvoiceTotals)

    setSearchTerm('')
  }

  return (
    <SafeAreaView>
      <ScrollView>{/* vertical scrolling */}
        <View style={{ padding: 20, height: screenHeight }}>
          <Text style={{ fontSize: 30, fontWeight: 'bold' }}>Search Only Yours</Text>
          {
            loading
            ?
              <View>
                <Text>Loaded { loadedNumber }...</Text>
                <ActivityIndicator color="#00FF00" />
              </View>
            :
              <View>

                {
                  searchResults == null
                  ?
                    <View>
                      <Text>
                          Filter (optional)
                          &nbsp;
                          <Icon name="info-circle" onPress={() => setShowSearchInfoModal(true)} />
                      </Text>

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
                    </View>
                  :
                    <View />
                }

                {/* horizontal scrolling for actions & long string values */}
                <ScrollView horizontal={ true }>

                  <FlatList
                    data={searchResults}
                    keyExtractor={item => item.id.toString()}
                    ItemSeparatorComponent={() => <View style={styles.line} />}
                    ListEmptyComponent={<Text>{ searchResults == null ? "" : "None" }</Text>}
                    /* fixed height is critical for iOS vertical scroll */
                    style={{
                      borderWidth: searchResults == null ? 0 : 1,
                      height: searchResults == null ? 60 : 500,
                    }}
                    ListHeaderComponent={
                      <View>
                        {
                          searchResults != null
                          ? <View style={{ marginBottom: 10 }}>
                              <Text style={{ fontSize: 20, fontWeight: 'bold' }}>
                                Matching Claims
                              </Text>
                              <Text>{ maybeMore ? "(Showing the most recent, up to 50.)" : "" }</Text>
                            </View>
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
                                              currencyLabel: utility.currencyShortWordForCode(arr[0]),
                                              offerList: currencyEntriesOutstanding[arr[0]],
                                            }
                                          )
                                        }
                                      >
                                        {utility.displayAmount(arr[0], arr[1])}
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
                                              currencyLabel: utility.currencyShortWordForCode(arr[0]),
                                              givenList: currencyEntriesPaid[arr[0]],
                                            }
                                          )
                                        }
                                      >
                                        {utility.displayAmount(arr[0], arr[1])}
                                      </Text>,
                                    R.toPairs(totalCurrenciesPaid)
                                  )
                                }
                              </View>
                            </View>
                        }

                        {
                          (numStrangesAndUnknowns > 0)
                          ?
                            <View>
                              <View style={styles.line} />
                              <Text>
                                {numStrangesAndUnknowns} of these claims
                                {numStrangesAndUnknowns === 1 ? " does" : " do"}
                                &nbsp;not have measurable info.
                              </Text>
                            </View>
                          :
                            <View />
                        }

                        <View style={styles.line} />
                      </View>
                    }

                    ListFooterComponent={
                      <View style={{ marginBottom: 100}}>{/* Without this, bottom tabs hide the bottom. */}</View>
                    }

                    renderItem={ data =>
                      <RenderOneRecord
                        source={data.item} navigation={navigation} outstandingPerInvoice={outstandingPerInvoice}
                      />
                    }
                  />
                </ScrollView>




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
                        style={styles.cancelButton}
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

              </View>
          }
        </View>

      </ScrollView>
    </SafeAreaView>
  )
}
