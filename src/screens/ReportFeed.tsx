import { classToPlain } from 'class-transformer'
import React, { useState } from 'react'
import { ActivityIndicator, Button, FlatList, Item, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { useSelector } from 'react-redux'

import { styles } from './style'
import { MASTER_COLUMN_VALUE, Settings } from "../entity/settings"
import * as utility from '../utility/utility'
import { YamlFormat } from '../utility/utility.tsx'
import { appSlice, appStore, DEFAULT_ENDORSER_API_SERVER, DEFAULT_ENDORSER_VIEW_SERVER } from '../veramo/appSlice'
import { dbConnection } from "../veramo/setup"

export function ReportFeedScreen({ navigation }) {

  const [feedData, setFeedData] = useState<utility.EndorserRecord>([])
  const [feedError, setFeedError] = useState<string>()
  const [feedHitLimit, setFeedHitLimit] = useState<boolean>(false)
  const [feedPreviousLastId, setFeedPreviousLastId] = useState<string>(appStore.getState().settings.lastViewedClaimId)
  const [thisSessionsOldestFeedId, setThisSessionsOldestFeedId] = useState<string>()
  const [loadingRecent, setLoadingRecent] = useState<boolean>(true)

  const identifiers = useSelector((state) => state.identifiers || [])

  const updateFeed = async () => {
    setLoadingRecent(true)

    await utility.retrieveClaims(
      appStore.getState().settings.apiServer, identifiers[0], feedPreviousLastId, thisSessionsOldestFeedId
    )
    .then(async results => {
      if (results.data.length > 0) {
        setFeedData(previousData => previousData.concat(results.data))
        setFeedHitLimit(results.hitLimit)
        setThisSessionsOldestFeedId(results.data[results.data.length - 1].id)

        newLastViewedId = results.data[0].id
        const settings = classToPlain(appStore.getState().settings)
        if (!settings.lastViewedClaimId
            || newLastViewedId > settings.lastViewedClaimId) {
          const conn = await dbConnection
          await conn.manager.update(
            Settings,
            MASTER_COLUMN_VALUE,
            { lastNotifiedClaimId: newLastViewedId, lastViewedClaimId: newLastViewedId }
          )

          settings.lastNotifiedClaimId = newLastViewedId
          settings.lastViewedClaimId = newLastViewedId
          appStore.dispatch(appSlice.actions.setSettings(settings))
        }

      }
    })
    .catch(e => {
      console.log('Error with feed', e)
      setFeedError('Got error retrieving feed data.')
    })

    setLoadingRecent(false)
  }

  useFocusEffect(
    React.useCallback(() => {
      updateFeed()
    }, [])
  )

  return (
    <SafeAreaView>
      <View style={{ padding: 20 }}>
        <Text style={{ fontSize: 30, fontWeight: 'bold' }}>Recent
          {
            (appStore.getState().settings.apiServer !== DEFAULT_ENDORSER_API_SERVER
             || appStore.getState().viewServer !== DEFAULT_ENDORSER_VIEW_SERVER)
             ? " - Custom Servers"
             : ""
          }
        </Text>
        <Text style={{ color: 'red' }}>{feedError}</Text>
        <FlatList
          data={ feedData }
          keyExtractor={ item => item.id }
          initialNumToRender={ 10 }
          renderItem={ data => (
            <YamlFormat source={ [data.item] } navigation={navigation} afterItemCss={styles.line} />
          )}
          style={{ borderWidth: 1, height: feedData.length > 0 ? 500 : 60 }}
          ListFooterComponent={(
            <View>
              <ActivityIndicator color="#00ff00" animating={ loadingRecent }/>
              <View style={{ display: (loadingRecent ? "none" : "flex")}}>
                <View style={{ display: (feedHitLimit ? "flex" : "none")}}>
                  <Button
                    title="Load More"
                    onPress={ updateFeed }
                  />
                </View>
                <View style={{ display: (feedHitLimit ? "none" : "flex")}}>
                  <Text>
                    You're all caught up.
                  </Text>
                </View>
              </View>
            </View>
          )}
        />
      </View>
    </SafeAreaView>
  )
}
