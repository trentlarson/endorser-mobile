import React from 'react'
import { Alert, FlatList, Modal, Text, TouchableHighlight, View } from 'react-native'
import { useSelector } from 'react-redux'

import { styles } from './style'

export function ContactSelectModal(props) {

  const allContacts = useSelector((state) => state.contacts || [])

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