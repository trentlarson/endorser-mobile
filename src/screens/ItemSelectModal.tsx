import React from 'react'
import { FlatList, Modal, Text, TouchableHighlight, View } from 'react-native'

import { styles } from './style'

export function ItemSelectModal(props) {

  const allItems = props.list

  return (
    <Modal
      animationType="slide"
      transparent={true}
      onRequestClose={props.cancel}
    >
      <View style={styles.modalView}>
        <FlatList
          data={allItems}
          keyExtractor={item => item}
          renderItem={data =>
            <TouchableHighlight
              style={styles.saveButton}
              onPress={ () => props.proceed(data.item) }
            >
              <Text>{data.item}</Text>
            </TouchableHighlight>
          }
          ListEmptyComponent={
            <Text>No Items Available</Text>
          }
          ListHeaderComponent={
            <Text>Choose One</Text>
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
