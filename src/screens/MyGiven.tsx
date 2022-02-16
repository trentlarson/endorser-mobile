import { FlatList, SafeAreaView, Text, View } from 'react-native'
import React from 'react'
import { useSelector } from 'react-redux'

import * as utility from '../utility/utility'

export function MyGivenScreen({ navigation, route }) {

  const {
    currencyLabel,
    givenList, // list of containers of claims
  } = route.params

  const allIdentifiers = useSelector((state) => state.identifiers || [])
  const allContacts = useSelector((state) => state.contacts || [])

  return (
    <SafeAreaView>
      <Text style={{ fontSize: 30, fontWeight: 'bold' }}>Given { currencyLabel }</Text>
      <FlatList
        data={givenList}
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
              <Text>{ data.item.claim.object.amountOfThisGood } to { label } { recipient }</Text>
            </View>
          )
        }}
        style={{ padding: 10 }}
      />
    </SafeAreaView>
  )

}