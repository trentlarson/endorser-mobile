
import notifee from '@notifee/react-native';

import { MASTER_COLUMN_VALUE, Settings } from '../entity/settings'
import * as utility from '../utility/utility'
import { DEFAULT_ENDORSER_API_SERVER } from '../veramo/appSlice'
import { agent, dbConnection } from '../veramo/setup'

/**
 * return Promise of
 *   jwts: array of JWT objects
 *   maybeMore: boolean telling whether there may be more
 */
const moreTransactions = async (endorserApiServer, identifier, prevId) => {
  const token = await utility.accessToken(identifier)
  let maybeMoreAfterQuery = prevId == null ? '' : '?afterId=' + prevId
  return fetch(endorserApiServer + '/api/reportAll/claims' + maybeMoreAfterQuery, {
    method: 'GET',
    headers: {
      "Content-Type": "application/json",
      "Uport-Push-Token": token,
    }
  }).then(response => {
    if (response.status !== 200) {
      throw Error('There was a low-level error from the server.')
    }
    return response.json()
  }).then(results => {
    if (results.data) {
      return results
    } else {
      throw Error(results.error || 'The server got an error. (For details, see the log on the Settings page.)')
    }
  })
}

module.exports = async (taskData) => {
  console.log('Starting background JavaScript with data', taskData)
  try {

    const conn = await dbConnection
    let settings = await conn.manager.findOne(Settings, MASTER_COLUMN_VALUE)

    if (settings) {

      // first, record that we've started this process
      settings.lastDailyTaskTime = new Date().toISOString()
      await conn.manager.save(Settings, settings)

      // load any new items from the sersver
      const endorserApiServer = DEFAULT_ENDORSER_API_SERVER

      const agentIdentifiers = await agent.didManagerFind()
      const id0 = agentIdentifiers[0] // type is @veramo/core IIdentifier

      let newClaimCount = 0
      let lastClaimId = null
      let maybeMoreAfter = settings.lastNotifiedClaimId
      do {
        let nextResults = await moreTransactions(endorserApiServer, id0, maybeMoreAfter)
        if (nextResults.data) {
          newClaimCount += nextResults.data.length
          if (nextResults.data.length > 0) {
            lastClaimId = nextResults.data[nextResults.data.length - 1].id
          }
          maybeMoreAfter = nextResults.maybeMoreAfter
        }
      } while (maybeMoreAfter)

      // notify the user if there's anything new
      if (newClaimCount > 0) {
        if (lastClaimId !== settings.lastNotifiedClaimId) {

          await notifee.displayNotification({
            title: 'New Endorser Claims',
            body: 'There are ' + newClaimCount + ' new claims.',
            android: {
              channelId: utility.DEFAULT_ANDROID_CHANNEL_ID,
              pressAction: {
                id: 'default', // launch the application on press
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
