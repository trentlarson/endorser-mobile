import * as R from 'ramda'
import { ActivityIndicator, Button, FlatList, SafeAreaView, Text, View } from 'react-native'
import React, { useState } from "react";
import { useFocusEffect } from "@react-navigation/native";

import { appStore, AppState } from "../veramo/appSlice";
import * as utility from "../utility/utility";
import { useSelector } from "react-redux";

export function ContactCorrelateChoicesScreen({ navigation, route }) {

  const claims: Array<utility.EndorserRecord> = route.params.claims

  const [apiError, setApiError] = useState('')
  const [confirmerIds, setConfirmerIds] = useState([])
  const [hasHidden, setHasHidden] = useState(false)
  const [loadingContacts, setLoadingContacts] = useState(false)

  const allIdentifiers = useSelector((state: AppState) => state.identifiers || [])
  const allContacts = useSelector((state: AppState) => state.contacts || [])

  useFocusEffect(
    React.useCallback(() => {
      async function loadContacts() {
        setLoadingContacts(true)

        const url =
          appStore.getState().settings.apiServer + '/api/v2/report/confirmers'
        const userToken = await utility.accessToken(allIdentifiers[0])
        const claimIds = claims.map(claim => claim.id)
        await fetch(url, {
          method: 'POST',
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + userToken
          },
          body: JSON.stringify({ claimEntryIds: claimIds }),
        })
        .then(async response => {
          if (response.status === 200) {
            return response.json()
          } else {
            const text = await response.text()
            throw 'Got from server: ' + text
          }
        })
        .then(data => {
          let result = data.data
          if (utility.containsHiddenDid(result)) {
            setHasHidden(true)
            result = R.reject(utility.isHiddenDid, result)
          }
          setConfirmerIds(result)
        })
        .catch(err =>
          setApiError('Got error loading confirmers: ' + err)
        )

        setLoadingContacts(false)
      }

      loadContacts()
    }, [])
  )

  return (
    <SafeAreaView>
      <Text style={{ fontWeight: 'bold' }}>Correlate Choices</Text>
      {apiError ? <Text style={{ color: 'red' }}>{apiError}</Text> : <View />}
      {loadingContacts ? <ActivityIndicator color="#00ff00" /> : <View />}
      {hasHidden ? <Text>Some contacts are not visible to you.</Text> : <View />}
      <View style={{ padding: 10 }}>
        <FlatList
          data={confirmerIds}
          keyExtractor={datum => datum}
          renderItem={datum =>
            <Text>{utility.didInfo(datum.item, allIdentifiers, allContacts)}</Text>
          }
          ListFooterComponent={
            loadingContacts
            ? <View />
            :
              <Button
                title="Match on These Contacts"
                onPress={() => navigation.navigate('Contact Correlate', { confirmerIds })}
              />
          }
        />
      </View>
    </SafeAreaView>
  )
}
