import * as R from 'ramda'
import React, { useState } from 'react'
import { ActivityIndicator, Button, FlatList, Linking, Modal, SafeAreaView, ScrollView, Text, TextInput, TouchableHighlight, View } from 'react-native'
import { CheckBox } from 'react-native-elements'
import { useFocusEffect } from '@react-navigation/native'
import { useSelector } from 'react-redux'

import { styles } from './style'
import * as utility from '../utility/utility'
import { appStore } from '../veramo/appSlice'
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

  /** This works, but I like the 'React' version better.
  const objectToYamlString = (obj, indentLevel) => {
    if (indentLevel == null) {
      indentLevel = 0
    }
    const indentString = R.join('', R.repeat('     ', indentLevel))

    if (obj instanceof Object) {
      if (Array.isArray(obj)) {
        // array: loop through elements
        return (
          R.join(
            "",
            obj.map((item, index) =>
              "\n" + indentString + "- " + objectToYamlString(item, indentLevel + 1)
            )
          )
        )
      } else {
        // regular object: loop through keys
        return (
          R.join(
            "",
            R.keys(obj).map((key, index) =>
              "\n" + indentString + key + " : " + objectToYamlString(obj[key], indentLevel + 1)
            )
          )
        )
      }
    } else {
      return JSON.stringify(obj)
    }
  }
  **/

  const objectToYamlReact = (obj, claimId, visibleToDids) => {
    if (obj instanceof Object) {
      if (Array.isArray(obj)) {
        // array: loop through elements
        return (
          <View style={{ padding: 1 }}>
            {
              obj.map((item, index) =>
                <View key={ index } style={{ marginLeft: 5 }}>
                  <Text>- </Text>{ objectToYamlReact(item, claimId || item.id) }
                </View>
              )
              /** This complained about being inside a ScrollView, and about nesting.
              <FlatList
                data={ obj }
                keyExtractor={(item, index) => "" + index}
                renderItem={(item, index) =>
                  <View style={{ marginLeft: 5 }}>
                    <Text>- </Text>{ objectToYamlReact(item, claimId || item.id) }
                  </View>
                }
              />
              **/
            }
          </View>
        )
      } else {
        // regular object: loop through keys
        return (
          <View style={{ padding: 1 }}>
            {
              R.keys(obj).map((key, index) => {
                const newline = obj[key] instanceof Object ? "\n" : ""
                return (
                  <Text key={ index } style={{ marginLeft: 20 }}>
                    { key } : { newline }{ objectToYamlReact(obj[key], claimId, obj[key + 'VisibleToDids']) }
                  </Text>
                )}
              )
            }
          </View>
        )
      }
    } else {
      const isVisibleDid = (typeof obj == 'string' && utility.isDid(obj) && !utility.isHiddenDid(obj))
      const style = (visibleToDids != null || isVisibleDid) ? { color: 'blue' } : {}
      const onPress =
        (visibleToDids != null)
        ? () => { setClaimIdForLinkedModal(claimId); setDidsForLinkedModal(visibleToDids) }
        : isVisibleDid
          ? () => { setDidForVisibleModal(obj) }
          : () => {}
      return (
        <Text
          style={ style }
          onPress={ onPress }
        >
          { JSON.stringify(obj) }
        </Text>
      )
    }
  }

  const filteredResultOutput = (results) => {
    // assuming results is an array
    const filteredResults =
      showClaimsWithoutDids
      ? results
      : R.filter(utility.containsNonHiddenDid, results)
    return objectToYamlReact(filteredResults)
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
              loading
              ?
                <ActivityIndicator color="#00ff00" />
              :
                <View>
                  <Button
                    title="Search"
                    onPress={searchEndorser}
                  />

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
                    visible={!!didForVisibleModal}
                  >
                    <View style={styles.centeredView}>
                      <View style={styles.modalView}>
                        <Text>
                          { utility.didInContext(didForVisibleModal, identifiers, allContacts) }
                        </Text>
                        <TouchableHighlight
                          style={styles.cancelButton}
                          onPress={() => {
                            setDidForVisibleModal(null)
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
                                <Text key={ did } style={{ padding: 10 }}>
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
                  onPress={() => navigation.navigate('My Credentials')}
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
