import * as R from 'ramda'
import React, { useState } from 'react'
import { ActivityIndicator, Button, FlatList, Linking, Modal, SafeAreaView, ScrollView, Text, TextInput, TouchableHighlight, View } from 'react-native'
import { CheckBox } from 'react-native-elements'
import { useFocusEffect } from '@react-navigation/native'
import { useSelector } from 'react-redux'

import { styles } from './style'
import * as utility from '../utility/utility'
import { YamlFormat } from '../utility/utility.tsx'
import { appStore, DEFAULT_ENDORSER_API_SERVER, DEFAULT_ENDORSER_VIEW_SERVER } from '../veramo/appSlice'
import { agent } from '../veramo/setup'
import { MyCredentialsScreen } from './MyCredentials'

export function ReportScreen({ navigation }) {

  const [claimIdForLinkedModal, setClaimIdForLinkedModal] = useState<string>()
  const [didsForLinkedModal, setDidsForLinkedModal] = useState<Array<string>>(null)
  const [didForVisibleModal, setDidForVisibleModal] = useState<string>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [searchResults, setSearchResults] = useState()
  const [showClaimsWithoutDids, setShowClaimsWithoutDids] = useState(false)

  const identifiers = useSelector((state) => state.identifiers || [])
  const allContacts = useSelector((state) => state.contacts || [])

  const filteredResultOutput = (results) => {
    // assuming results is an array
    const filteredResults =
      showClaimsWithoutDids
      ? results
      : R.filter(utility.containsNonHiddenDid, results)
    return <YamlFormat
      source={ filteredResults }
      navigation={ navigation }
      onClickVisibleToDids={ (claimId, visibleToDids) => {
        setClaimIdForLinkedModal(claimId)
        setDidsForLinkedModal(visibleToDids)
      }}
     />
  }

  const searchEndorser = async () => {
    setLoading(true)
    const token = await utility.accessToken(identifiers[0])
    fetch(appStore.getState().apiServer + '/api/claim?claimContents=' + searchTerm, {
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
    }).then(result => {
      setSearchResults(result)
    })
  }

  return (
    <SafeAreaView>
      <ScrollView horizontal={ true }>{/* horizontal scrolling for long string values */}
        <ScrollView>{/* vertical scrolling */}
          <View style={{ padding: 20 }}>
            <Text style={{ fontSize: 30, fontWeight: 'bold' }}>Search All
                {
                  (appStore.getState().apiServer !== DEFAULT_ENDORSER_API_SERVER
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
            <Text>
              Examples:&nbsp;
              <Text style={{ color: 'blue' }} onPress={() => { setSearchTerm('programming') }}>programming</Text>,&nbsp;
              <Text style={{ color: 'blue' }} onPress={() => { setSearchTerm('Training') }}>Training</Text>,&nbsp;
              <Text style={{ color: 'blue' }} onPress={() => { setSearchTerm('JoinAction') }}>JoinAction</Text>
            </Text>
            {
              loading
              ?
                <ActivityIndicator color="#00ff00" />
              :
                <View>
                  <Button
                    title="Search"
                    onPress={searchEndorser}
                  />
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

                  <Modal
                    animationType="slide"
                    transparent={true}
                    visible={!!didsForLinkedModal}
                  >
                    <View style={styles.centeredView}>
                      <View style={styles.modalView}>
                        <Text>
                          This person can be seen by the people in your network, below.
                          Ask one of them to give you more information about <Text style={{ color: 'blue' }} onPress={() => Linking.openURL(appStore.getState().viewServer + '/reportClaim?claimId=' + claimIdForLinkedModal)}>this claim</Text>.
                        </Text>

                        {
                          didsForLinkedModal != null
                          ? didsForLinkedModal.map((did) => {
                              const contact = R.find(con => con.did === did, allContacts)
                              return (
                                <Text key={ did } style={{ padding: 10 }} selectable={ true }>
                                  { utility.didInContext(did, identifiers, allContacts) }
                                </Text>
                              )
                            })
                          : <View/>
                        }
                        <TouchableHighlight
                          style={styles.cancelButton}
                          onPress={() => {
                            setDidsForLinkedModal(null)
                          }}
                        >
                          <Text>Close</Text>
                        </TouchableHighlight>
                      </View>
                    </View>
                  </Modal>

                </View>
            }
          </View>
          { identifiers.length > 0
            ?
              <View style={{ padding: 20 }}>
                <Text style={{ fontSize: 30, fontWeight: 'bold' }}>Search Your Credentials</Text>
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
