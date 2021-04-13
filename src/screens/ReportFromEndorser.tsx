import React, { useState } from 'react'
import { ActivityIndicator, Button, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'

import * as utility from '../utility/utility'
import { appStore } from '../veramo/appSlice'
import { agent } from '../veramo/setup'

export function ReportScreen({ navigation }) {

  const [identifiers, setIdentifiers] = useState<Identifier[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [searchResults, setSearchResults] = useState()

  const searchEndorser = async () => {
    setLoading(true)
    const endorserApiServer = appStore.getState().apiServer
    const token = await utility.accessToken(identifiers[0])
    fetch(endorserApiServer + '/api/claim?claimContents=' + searchTerm, {
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
          <Text style={{ fontSize: 30, fontWeight: 'bold' }}>Search</Text>
          <TextInput
            value={searchTerm}
            onChangeText={setSearchTerm}
            editable
            style={{ borderWidth: 1 }}
          />
          <Button
            title="Search"
            onPress={searchEndorser}
          />
          {
            loading
            ?
              <ActivityIndicator color="#00ff00" />
            :
              <View>
                <Text>
                  { JSON.stringify(searchResults) }
                </Text>
              </View>
          }
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
