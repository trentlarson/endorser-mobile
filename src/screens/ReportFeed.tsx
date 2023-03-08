import { classToPlain } from 'class-transformer'
import * as R from 'ramda'
import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator, Button, FlatList, Item, SafeAreaView, ScrollView, Text, TextInput, View
} from 'react-native'
import { useSelector } from 'react-redux'

import { styles } from './style'
import { MASTER_COLUMN_VALUE, Settings } from "../entity/settings"
import * as utility from '../utility/utility'
import { RenderOneRecord } from '../utility/utility.tsx'
import {
  appSlice, appStore, DEFAULT_ENDORSER_API_SERVER, DEFAULT_ENDORSER_VIEW_SERVER
} from '../veramo/appSlice'
import { dbConnection } from "../veramo/setup"

export function ReportFeedScreen({ navigation, route }) {

  const subfeed = route.params?.subfeed

  const [clickedSubLoad, setClickedSubLoad] = useState<boolean>(false)
  const [feedData, setFeedData] = useState<utility.EndorserRecord>([])
  const [feedError, setFeedError] = useState<string>()
  const [feedHitLimit, setFeedHitLimit] = useState<boolean>(false)
  const [feedPreviousLastId, setFeedPreviousLastId] =
    useState<string>(appStore.getState().settings.lastViewedClaimId)
  const [loadingAllRecent, setLoadingAllRecent] = useState<boolean>(false)
  const [loadingSubfeedRecent, setLoadingSubfeedRecent] = useState<boolean>(false)
  const [showAllFeed, setShowAllFeed] = useState<boolean>(subfeed ? false : true)
  const [subfeedData, setSubfeedData] = useState<utility.EndorserRecord>([])
  const [subfeedError, setSubfeedError] = useState<string>()
  const [subfeedHitLimit, setSubfeedHitLimit] = useState<boolean>(false)
  const [subfeedPreviousLastId, setSubfeedPreviousLastId] =
    useState<string>(appStore.getState().settings.lastViewedClaimId)
  const [thisSessionsOldestFeedId, setThisSessionsOldestFeedId] = useState<string>()
  const [thisSubfeedSessionsOldestFeedId, setThisSubfeedSessionsOldestFeedId] = useState<string>()

  const allIdentifiers = useSelector((state) => state.identifiers || [])
  const allContacts = useSelector((state) => state.contacts || [])

  const updateSubfeed = async (subfeedCode) => {
    setLoadingSubfeedRecent(true)

    await utility.retrieveClaims(
      appStore.getState().settings.apiServer,
      allIdentifiers[0],
      subfeedPreviousLastId,
      thisSubfeedSessionsOldestFeedId
    )
    .then(async results => {
      if (results.data.length > 0) {

        const contactChecker =
          utility.isDidOfInterestFrom(allContacts, allIdentifiers[0].did)
        let subfilter
        switch (subfeed) {
          case 'GiveAction': subfilter = utility.isGiveOfInterest(contactChecker); break;
          case 'Offer': subfilter = utility.isOfferOfInterest(contactChecker); break;
          case 'PlanAction': subfilter = utility.isPlanOfInterest(contactChecker); break;
          case 'Other': subfilter = utility.isNonPrimaryClaimOfInterest(contactChecker); break;
        }
        const filteredData = R.filter(subfilter, results.data)
        setSubfeedData(previousData => previousData.concat(filteredData))
        setSubfeedHitLimit(results.hitLimit)
        setThisSubfeedSessionsOldestFeedId(results.data[results.data.length - 1].id)
      }
    })
    .catch(e => {
      console.log('Error with subfeed', e)
      setSubfeedError('Got error retrieving subfeed data.')
    })

    setLoadingSubfeedRecent(false)
  }

  const updateAllFeed = async () => {
    setLoadingAllRecent(true)

    await utility.retrieveClaims(
      appStore.getState().settings.apiServer,
      allIdentifiers[0],
      feedPreviousLastId,
      thisSessionsOldestFeedId
    )
    .then(async results => {
      if (results.data.length > 0) {
        setFeedData(previousData => previousData.concat(results.data))
        setFeedHitLimit(results.hitLimit)
        setThisSessionsOldestFeedId(results.data[results.data.length - 1].id)

        const newLastViewedId = results.data[0].id
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

        appStore.dispatch(appSlice.actions.setRefreshHomeFeed(true))
      }
    })
    .catch(e => {
      console.log('Error with feed', e)
      setFeedError('Got error retrieving feed data.')
    })

    setLoadingAllRecent(false)
  }

  useEffect(() => {
    if (subfeed) {
      updateSubfeed(subfeed)
    }
    if (showAllFeed) {
      updateAllFeed()
    }
  }, [])

  return (
    <SafeAreaView>
      <View style={{ padding: 20 }}>

      {
        !showAllFeed
        ? (
          <View>
            <Text style={{ fontSize: 30, fontWeight: 'bold' }}>
              { utility.capitalizeAndInsertSpacesBeforeCaps(subfeed) }
              {
                (appStore.getState().settings.apiServer !== DEFAULT_ENDORSER_API_SERVER
                || appStore.getState().viewServer !== DEFAULT_ENDORSER_VIEW_SERVER)
                ? " - Custom Servers"
                : ""
              }
            </Text>
            <Text style={{ color: 'red' }}>{ subfeedError }</Text>
            <FlatList
              data={ subfeedData }
              keyExtractor={ item => item.id }
              initialNumToRender={ 10 }
              renderItem={ data => (
                <RenderOneRecord
                  source={ data.item }
                  navigation={ navigation }
                  afterItemCss={ styles.line }
                />
              )}
              style={{ borderWidth: 1, height: subfeedData.length > 0 ? 400 : 60 }}
              ListFooterComponent={(
                <View>
                  <ActivityIndicator color="#00ff00" animating={ loadingSubfeedRecent }/>
                  <View style={{ display: (loadingSubfeedRecent ? "none" : "flex") }}>
                    <View style={{ display: (subfeedHitLimit ? "flex" : "none") }}>
                      {
                        clickedSubLoad
                        ? <Text>
                            Checked further back in time.
                            It is possible that there were no matches in that time frame.
                            There may be more even further in the past.
                          </Text>
                        : <View />
                      }
                      <Button
                        title="Load More"
                        onPress={() => {
                          updateSubfeed(subfeed)
                          setClickedSubLoad(true)
                        }}
                      />
                    </View>
                    <View style={{ display: (subfeedHitLimit ? "none" : "flex") }}>
                      <Text>
                        You're all caught up.
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            />
          </View>
        ) : (
          <View />
        )
      }

      {
        showAllFeed
        ? (
          <View>
            <Text style={{ fontSize: 30, fontWeight: 'bold' }}>All
              {
                (appStore.getState().settings.apiServer !== DEFAULT_ENDORSER_API_SERVER
                 || appStore.getState().viewServer !== DEFAULT_ENDORSER_VIEW_SERVER)
                 ? " - Custom Servers"
                 : ""
              }
            </Text>
            <Text style={{ color: 'red' }}>{ feedError }</Text>
            <FlatList
              data={ feedData }
              keyExtractor={ item => item.id }
              initialNumToRender={ 10 }
              renderItem={ data => (
                <RenderOneRecord
                  source={ data.item }
                  navigation={ navigation }
                  afterItemCss={ styles.line }
                />
              )}
              style={{ borderWidth: 1, height: feedData.length > 0 ? 500 : 60 }}
              ListFooterComponent={(
                <View>
                  <ActivityIndicator color="#00ff00" animating={ loadingAllRecent }/>
                  <View style={{ display: (loadingAllRecent ? "none" : "flex") }}>
                    <View style={{ display: (feedHitLimit ? "flex" : "none") }}>
                      <Button
                        title="Load More"
                        onPress={ updateAllFeed }
                      />
                    </View>
                    <View style={{ display: (feedHitLimit ? "none" : "flex") }}>
                      <Text>
                        You're all caught up.
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            />
          </View>
        ) : (
          <Text
            style={{ padding: 10, color: "blue" }}
            onPress={() => { setShowAllFeed(true); updateAllFeed() } }
          >
            Show Entire Feed & Mark Everything Read
          </Text>
        )
      }
      </View>
    </SafeAreaView>
  )
}
