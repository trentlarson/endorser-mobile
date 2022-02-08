import * as R from 'ramda'
import { Duration } from 'luxon'
import React, { useState } from 'react'
import { ActivityIndicator, Button, Dimensions, FlatList, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { useSelector } from 'react-redux'

import { styles } from './style'
import * as utility from '../utility/utility'
import { appStore } from '../veramo/appSlice'
import { agent } from '../veramo/setup'

export function MyCredentialsScreen({ navigation }) {

  const [loading, setLoading] = useState<boolean>(false)
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [searchResults, setSearchResults] = useState()
  const [totalCurrencies, setTotalCurrencies] = useState<Record<string,number>>({})
  const [totalDuration, setTotalDuration] = useState<string>('')

  const identifiers = useSelector((state) => state.identifiers || [])

  const searchEndorser = async () => {
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

      // add up any promised amount or time values
      let promisedCurrencyTotals = {}
      let numUnknowns = 0;
      for (result of results) {
        const claim = result.claim;
        if (!claim) continue;
        const claimType = claim['@type']
        if (!claimType) continue;

        if (claimType === 'Offer') {
          if (!claim.offeredBy && !claim.seller) { numUnknowns++; continue; }
          if (claim.offeredBy.identifier !== identifiers[0].did
              && claim.seller.identifier !== identifiers[0].did) {
            numUnknowns++; continue;
          }
          const node = claim.itemOffered
          if (!node) { numUnknowns++; continue; }
          const amount = node.amountOfThisGood
          if (isNaN(amount)) { numUnknowns++; continue; }
          const currency = node.unitCode
          if (!currency) { numUnknowns++; continue; }
          promisedCurrencyTotals[currency] = (promisedCurrencyTotals[currency] || 0) + amount

        } else if (claimType === 'GiveAction') {
          if (!claim.agent || claim.agent.identifier !== identifiers[0].did) {
            numUnknowns++; continue;
          }
          const node = claim.object
          if (!node) { numUnknowns++; continue; }
          const amount = node.amountOfThisGood
          if (isNaN(amount)) { numUnknowns++; continue; }
          const currency = node.unitCode
          if (!currency) { numUnknowns++; continue; }
          promisedCurrencyTotals[currency] = (promisedCurrencyTotals[currency] || 0) - amount
        } else {
          // unknown type
        }
      }
      setTotalCurrencies(promisedCurrencyTotals)
      if (numUnknowns > 0) {
        console.log('Got', numUnknowns, 'transactions that were not formatted right.')
      }
    })
  }

  const isUser = did => did === identifiers[0].did

  const removeSchemaContext = obj => obj['@context'] === 'https://schema.org' ? R.omit(['@context'], obj) : obj

  const displayAmount = (curr, amt) =>
    '' + amt + ' ' + (curr === 'HUR' ? 'hours' : curr)

  // Hack because without this it doesn't scroll to the bottom: https://stackoverflow.com/a/67244863/845494
  const screenHeight = Dimensions.get('window').height - 200

  return (
    <SafeAreaView>
      <View style={{ padding: 20, height: screenHeight }}>
        <Text style={{ fontSize: 30, fontWeight: 'bold' }}>Search</Text>
        <Text>Filter (optional)</Text>
        <TextInput
          autoCapitalize={'none'}
          value={searchTerm}
          onChangeText={setSearchTerm}
          editable
          style={{ borderWidth: 1 }}
        />
        {
          loading
          ?
            <ActivityIndicator color="#00FF00" />
          :
            <View>
              <Button
                title="Search"
                onPress={searchEndorser}
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
                      (R.equals(totalCurrencies, {}) && !totalDuration)
                      ? <View/>
                      :
                        <View>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-evenly' }}>
                            <Text>Totals</Text>
                            <Text>{totalDuration || ''}</Text>
                            {
                              R.map(
                                arr => <Text key={arr[0]}>{displayAmount(arr[0], arr[1])}</Text>,
                                R.toPairs(totalCurrencies)
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
                              isUser(data.item.issuer)
                              ? navigation.navigate('Present Credential', { fullClaim: data.item })
                              : null
                            }
                          >
                            <Text style={{ color: "blue" }}>Present it</Text>
                          </Pressable>
                        : <View/>
                      }

                      {
                        !isUser(data.item.issuer)
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
                        data.item.claim['@type'] === 'LoanOrCredit'
                        || data.item.claim['@type'] === 'GiveAction'
                        ?
                          <Pressable
                            style={{ padding: 10 }}
                            onPress={ () =>
                              navigation.navigate('Sign Credential', {
                                credentialSubject: {
                                  "@context": "https://schema.org",
                                  "@type": "TakeAction",
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
