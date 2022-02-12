import { FlatList, SafeAreaView, Text, View } from 'react-native'
import React from 'react'
import { useSelector } from 'react-redux'

import * as utility from '../utility/utility'

export function MyOffersScreen({ navigation, route }) {

  const {
    currencyLabel,
    offerList, // list of containers of claims
  } = route.params

  const allIdentifiers = useSelector((state) => state.identifiers || [])
  const allContacts = useSelector((state) => state.contacts || [])

  return (
    <SafeAreaView>
      <Text style={{ fontSize: 30, fontWeight: 'bold' }}>Outstanding Promised { currencyLabel }</Text>
      <FlatList
        data={offerList}
        keyExtractor={item => item.id.toString()}
        ListEmptyComponent={<Text>None</Text>}
        renderItem={(data) => {
          let label, recipient
          if (data.item.claim.recipient) {
            label = "Recipient"
            recipient = utility.didInContext(data.item.claim.recipient.identifier, allIdentifiers, allContacts)
          } else {
            label = "Invoice"
            recipient = data.item.claim.identifier
          }
          return (
            <View>
              <Text>{ data.item.claim.itemOffered.amountOfThisGood } to { label } { recipient }</Text>
            </View>
          )
        }}
      />
    </SafeAreaView>
  )

}
