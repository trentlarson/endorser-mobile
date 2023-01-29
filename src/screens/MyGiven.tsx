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
            recipient = utility.didInfo(data.item.claim.recipient.identifier, allIdentifiers, allContacts)
          } else if (data.item.claim.identifier) {
            label = "Invoice"
            recipient = data.item.claim.identifier
          } else {
            label = "Unknown Recipient"
            recipient = ""
          }
          return (
            <View>
              <Text>{ data.item.claim.object.amountOfThisGood } to { label } { recipient }</Text>
              <Text style={{ color: 'blue' }} onPress={() => navigation.navigate('Verify Credential', { wrappedClaim: data.item })}>See Details</Text>
            </View>
          )
        }}
        style={{ padding: 10 }}
      />
    </SafeAreaView>
  )

}
