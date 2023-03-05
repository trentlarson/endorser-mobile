import { FlatList, SafeAreaView, Text, View } from 'react-native'
import React from 'react'
import { useSelector } from 'react-redux'

import * as utility from '../utility/utility'

export function MyGivenScreen({ navigation, route }) {

  const {
    currencyLabel,
    givenList, // list of two-element array: [invoice ID & full claim entry]
  } = route.params

  const allIdentifiers = useSelector((state) => state.identifiers || [])
  const allContacts = useSelector((state) => state.contacts || [])

  return (
    <SafeAreaView>
      <Text style={{ fontSize: 30, fontWeight: 'bold' }}>Given { currencyLabel }</Text>
      <FlatList
        data={givenList}
        keyExtractor={item => item[0] || "undefined"} // those without ID or recipient will have a key of undefined
        ListEmptyComponent={<Text>None</Text>}
        renderItem={(data) => {
          let label, recipient
          if (data.item[1].claim.recipient?.identifier) {
            label = "Recipient"
            recipient =
              utility.didInfo(data.item[1].claim.recipient.identifier, allIdentifiers, allContacts)

          } else if (data.item[1].claim.fulfills?.identifier) {
            label =
              utility.capitalizeAndInsertSpacesBeforeCaps(data.item[1].claim.fulfills['@type'])
            recipient =
              utility.didInfo(data.item[1].claim.fulfills.identifier, allIdentifiers, allContacts)

          } else {
            label = "No Specific Recipient or Invoice"
            recipient = ""
          }
          return (
            <View>
              <Text>
                { data.item[1].claim.object.amountOfThisGood } to { label } to { recipient }
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
        style={{ padding: 10 }}
      />
    </SafeAreaView>
  )

}
