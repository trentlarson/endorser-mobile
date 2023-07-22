import * as R from 'ramda'
import React, { useEffect } from "react";
import { FlatList, Modal, Text, TouchableHighlight, View } from 'react-native'

import { styles } from './style'
import * as utility from '../utility/utility'
import { dbConnection } from "../veramo/setup"

export function BookmarkSelectModal(props) {

  const [allBookmarks, setAllBookmarks] = React.useState([])

  useEffect(() => {
    const getBookmarks = async () => {
      const marks = await utility.loadBookmarks(dbConnection)
      setAllBookmarks(marks)
    }
    getBookmarks()
  }, [])

  return (
    <Modal
      animationType="slide"
      transparent={true}
      onRequestClose={props.cancel}
    >
      <View style={styles.modalView}>
        <FlatList
          data={allBookmarks}
          keyExtractor={item => item.claimId}
          renderItem={data =>
            <TouchableHighlight
              style={styles.saveButton}
              onPress={ () => props.proceed(data.item.claimId) }
            >
              <Text>{data.item.name}</Text>
            </TouchableHighlight>
          }
          ListEmptyComponent={
            <Text>You Have Not Bookmarked Any</Text>
          }
          ListHeaderComponent={
            <Text>Choice of Bookmarked Projects</Text>
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
