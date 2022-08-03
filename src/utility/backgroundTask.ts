
import notifee from '@notifee/react-native';

import { MASTER_COLUMN_VALUE, Settings } from '../entity/settings'
import * as utility from '../utility/utility'
import { agent, dbConnection } from '../veramo/setup'

const checkServer = async (taskData) => {
  console.log('Starting background JavaScript with data', taskData)
  try {

    const conn = await dbConnection
    let settings = await conn.manager.findOne(Settings, MASTER_COLUMN_VALUE)

    if (settings) {

      // first, record that we've started this process
      settings.lastDailyTaskTime = new Date().toISOString()
      await conn.manager.save(Settings, settings)

      // load any new items from the sersver
      const endorserApiServer = settings.apiServer

      const agentIdentifiers = await agent.didManagerFind()
      const id0 = agentIdentifiers[0] // type is @veramo/core IIdentifier

      const afterId = settings.lastNotifiedClaimId
      let newClaimCount = 0
      let lastClaimId = null
      let beforeId = null
      do {
        const nextResults = await utility.retrieveClaims(endorserApiServer, id0, afterId, beforeId)
        if (nextResults.data) {
          newClaimCount += nextResults.data.length
          // only set lastClaimId the first time through the loop, only if we get results.
          if (lastClaimId == null
              && nextResults.data.length > 0) {
            lastClaimId = nextResults.data[0].id
          }
          beforeId = nextResults.hitLimit ? nextResults.data[nextResults.data.length - 1] : null
        } else {
          // there was probably some error, since we'd expect at least []; anyway, stop
          beforeId = null
        }
      } while (beforeId)

      // notify the user if there's anything new
      if (newClaimCount > 0) {
        if (lastClaimId !== settings.lastNotifiedClaimId) {

          notifee.onBackgroundEvent(async () => {}) // without this explicit setting it complains that "no background event handler has been set"... stupid

          const message =
            newClaimCount === 1
            ? 'There is 1 new claim.'
            : 'There are ' + newClaimCount + ' new claims.'
          await notifee.displayNotification({
            title: 'New Endorser Claims',
            body: message,
            android: {
              channelId: utility.DEFAULT_ANDROID_CHANNEL_ID,
              pressAction: {
                id: utility.FEED_ACTION, // launch the application on press
              }
              //smallIcon: 'name-of-a-small-icon', // optional, defaults to 'ic_launcher'.
            },
          });

          settings.lastNotifiedClaimId = lastClaimId
          await conn.manager.save(Settings, settings)
        }
      }
    } else {
      // There are no settings yet, so we'll just wait until next time, when the DB initialization should be finished.
    }

    console.log('Finished background JavaScript.')
  } catch (e) {
    console.log('Got error in background JavaScript', e)
  }

}

module.exports = checkServer
