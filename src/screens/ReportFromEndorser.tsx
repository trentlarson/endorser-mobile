import * as R from 'ramda'
import React, { useState } from 'react'
import { ActivityIndicator, Button, Modal, SafeAreaView, ScrollView, Text, TextInput, TouchableHighlight, View } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { useSelector } from 'react-redux'

import { styles } from './style'
import * as utility from '../utility/utility'
import { appStore } from '../veramo/appSlice'
import { agent } from '../veramo/setup'
import { MyCredentialsScreen } from './MyCredentials'

export function ReportScreen({ navigation }) {

  const [loading, setLoading] = useState<boolean>(false)
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [searchResults, setSearchResults] = useState()

  const identifiers = useSelector((state) => state.identifiers || [])

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

  const objectToYamlReact = (obj) => {
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
                    { key } : { newline }{ objectToYamlReact(obj[key]) }
                  </Text>
                )}
              )
            }
          </View>
        )
      }
    } else {
      return <Text>{ JSON.stringify(obj) }</Text>
    }
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
                  <Text>
                    {
                      searchResults == null
                      ? ''
                      : searchResults.length == 0
                        ? 'No results'
                        : objectToYamlReact(searchResults)
                    }
                  </Text>
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
