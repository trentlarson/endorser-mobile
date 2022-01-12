import * as R from 'ramda'
import React, { useState } from 'react'
import { ActivityIndicator, Button, FlatList, Modal, SafeAreaView, ScrollView, Text, TextInput, TouchableHighlight, View } from 'react-native'
import { CheckBox } from 'react-native-elements'
import { useFocusEffect } from '@react-navigation/native'
import { useSelector } from 'react-redux'

import { styles } from './style'
import * as utility from '../utility/utility'
import { appStore } from '../veramo/appSlice'
import { agent } from '../veramo/setup'
import { MyCredentialsScreen } from './MyCredentials'

export function ReportScreen({ navigation }) {

  const [didsForModal, setDidsForModal] = useState<Array<string>>(null)
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

  const objectToYamlReact = (obj, visibleToDids) => {
    if (obj instanceof Object) {
      if (Array.isArray(obj)) {
        // array: loop through elements
        return (
          <View style={{ padding: 1 }}>
            {
              obj.map((item, index) =>
                <View key={ index } style={{ marginLeft: 5 }}>
                  <Text>- </Text>{ objectToYamlReact(item) }
                </View>
              )
              /** This complained about being inside a ScrollView, and about nesting.
              <FlatList
                data={ obj }
                keyExtractor={(item, index) => "" + index}
                renderItem={(item, index) =>
                  <View style={{ marginLeft: 5 }}>
                    <Text>- </Text>{ objectToYamlReact(item) }
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
                    { key } : { newline }{ objectToYamlReact(obj[key], obj[key + 'VisibleToDids']) }
                  </Text>
                )}
              )
            }
          </View>
        )
      }
    } else {
      let style = (visibleToDids == null) ? {} : { color: 'blue' }
      return (
        <Text
          style={ style }
          onPress={ () => setDidsForModal(visibleToDids) }
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

                  <CheckBox
                    title='Show claims without actionable IDs.'
                    checked={showClaimsWithoutDids}
                    onPress={() => setShowClaimsWithoutDids(!showClaimsWithoutDids)}
                  />

                  {
                    searchResults == null
                    ? <Text/>
                    : searchResults.length == 0
                      ? <Text>No results.</Text>
                      : filteredResultOutput(searchResults)
                  }

                  <Modal
                    animationType="slide"
                    transparent={true}
                    visible={!!didsForModal}
                  >
                    <View style={styles.centeredView}>
                      <View style={styles.modalView}>
                        <Text>This person can be seen by the following people:</Text>
                        {
                          didsForModal != null
                          ? didsForModal.map((did) => {
                              const contact = R.find(con => con.did === did, allContacts)
                              return (
                                <Text key={ did } style={{ padding: 10 }}>
                                  { did }
                                  {
                                    contact != null
                                    ? <Text>... who is in your contacts: { contact.name }</Text>
                                    : <Text>... who allows you to see them, but they're not in your contacts.</Text>
                                  }
                                </Text>
                              )
                            })
                          : <View/>
                        }
                        <TouchableHighlight
                          style={styles.cancelButton}
                          onPress={() => {
                            setDidsForModal(null)
                          }}
                        >
                          <Text>Cancel</Text>
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
