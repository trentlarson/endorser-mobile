import * as R from 'ramda'
import React from 'react'
import { Alert, FlatList, Modal, Text, TouchableHighlight, View } from 'react-native'
import { useSelector } from 'react-redux'

import { styles } from './style'

export function ContactSelectModal(props) {

  let allContacts =
    useSelector((state) => state.contacts || [])
  if (props.includeMyDid
      && !R.find(R.propEq('did', props.includeMyDid), allContacts)) {
    allContacts =
      R.append({ name: 'You', did: props.includeMyDid }, R.clone(allContacts))
  }

  return (
    <Modal
      animationType="slide"
      transparent={true}
      onRequestClose={props.cancel}
    >
      <View style={styles.modalView}>
        <FlatList
          data={allContacts}
          keyExtractor={item => item.did}
          renderItem={data =>
            <TouchableHighlight
              style={styles.saveButton}
              onPress={ () => props.proceed(data.item.did) }
            >
              <Text>{data.item.name}</Text>
            </TouchableHighlight>
          }
          ListEmptyComponent={
            <Text>You Have No Contacts</Text>
          }
          ListHeaderComponent={
            <Text>Choose A Contact</Text>
          }
        />

        <View style={{ padding: 10 }} />
        <TouchableHighlight
          style={styles.cancelButton}
          onPress={props.cancel}
        >
          <Text>Cancel</Text>
        </TouchableHighlight>
      </View>
    </Modal>
  )
}
