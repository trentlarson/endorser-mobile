import { FlatList, SafeAreaView, Text, View } from 'react-native'
import React from 'react'
import { useSelector } from 'react-redux'

import * as utility from '../utility/utility'

export function MyOffersScreen({ navigation, route }) {

  const {
    currencyLabel,
    // list of two-element array: [invoice ID & full claim entry]
    // and those without ID or recipient will have a invoice ID of undefined
    offerList,
  } = route.params

  const allIdentifiers = useSelector((state) => state.identifiers || [])
  const allContacts = useSelector((state) => state.contacts || [])

  return (
    <SafeAreaView>
      <Text style={{ fontSize: 30, fontWeight: 'bold' }}>Outstanding Promised { currencyLabel }</Text>
      <FlatList
        data={offerList}
        keyExtractor={(item, index) => '' + index}
        style={{ padding: 20 }}
        ListEmptyComponent={<Text>None</Text>}
        renderItem={(data) => {
          let label, recipient
          if (data.item[1].claim?.recipient) {
            label = "Recipient"
            recipient = utility.didInfo(data.item[1].claim.recipient.identifier, allIdentifiers, allContacts)
          } else if (data.item[1].claim?.identifier) {
            label = "Invoice"
            recipient = data.item[1].claim.identifier
          } else {
            label = "No Specific Recipient or Invoice"
            recipient = ""
          }
          return (
            <View>
              <Text>
                { data.item[1].claim.includesObject.amountOfThisGood }
                &nbsp;to { label } { recipient }
              </Text>
              <Text
                style={{ color: 'blue' }}
                onPress={() => navigation.navigate('Verify Credential', { wrappedClaim: data.item[1] })}
              >
                See Details
              </Text>
            </View>
          )
        }}
        ListFooterComponent={
          <View style={{ marginBottom: 100}}>{/* Without this, bottom tabs hide the bottom. */}</View>
        }
      />
    </SafeAreaView>
  )

}
