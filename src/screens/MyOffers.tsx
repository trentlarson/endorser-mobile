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
          if (data.item.claim?.recipient) {
            label = "Recipient"
            recipient = utility.didInContext(data.item.claim.recipient.identifier, allIdentifiers, allContacts)
          } else {
            label = "Invoice"
            recipient = data.item.claim?.identifier
          }
          return (
            <View>
              <Text>
                {/* The itemOffered version is for some legacy Offers on the endorser.ch ledger. */}
                { data.item.claim?.includesObject?.amountOfThisGood || data.item.claim?.itemOffered?.amountOfThisGood }
                &nbsp;to { label } { recipient }
              </Text>
              <Text
                style={{ color: 'blue' }}
                onPress={() => navigation.navigate('Verify Credential', { wrappedClaim: data.item })}
              >
                See Details
              </Text>
            </View>
          )
        }}
        style={{ padding: 10 }}
      />
    </SafeAreaView>
  )

}
