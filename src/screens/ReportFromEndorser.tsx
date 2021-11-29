import React, { useState } from 'react'
import { ActivityIndicator, Button, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'

import * as utility from '../utility/utility'
import { appStore } from '../veramo/appSlice'
import { agent } from '../veramo/setup'
import { MyCredentialsScreen } from './MyCredentials'

export function ReportScreen({ navigation }) {

  const [identifiers, setIdentifiers] = useState<Identifier[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [searchResults, setSearchResults] = useState()

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

  useFocusEffect(
    React.useCallback(() => {
      agent.didManagerFind().then(ids => setIdentifiers(ids))
    }, [])
  )

  return (
    <SafeAreaView>
      <ScrollView>
        <View style={{ padding: 20 }}>
          <Text style={{ fontSize: 30, fontWeight: 'bold' }}>Search All</Text>
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
              <ActivityIndicator color="#00ff00" />
            :
              <View>
                <Button
                  title="Search"
                  onPress={searchEndorser}
                />
                <Text>
                  { JSON.stringify(searchResults) }
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
    </SafeAreaView>
  )
}
