
import notifee from '@notifee/react-native';

import { MASTER_COLUMN_VALUE, Settings } from '../entity/settings'
import * as utility from '../utility/utility'
import { agent, dbConnection } from '../veramo/setup'

/**
 * return Promise of
 *   jwts: array of JWT objects
 *   hitLimit: boolean telling whether there may be more
 */
const moreTransactions = async (endorserApiServer, identifier, afterId, beforeId) => {
  const token = await utility.accessToken(identifier)
  const afterQuery = afterId == null ? '' : '&afterId=' + afterId
  const beforeQuery = beforeId == null ? '' : '&beforeId=' + beforeId
  return fetch(endorserApiServer + '/api/reportAll/claims?' + afterQuery + beforeQuery, {
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
        const nextResults = await moreTransactions(endorserApiServer, id0, afterId, beforeId)
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

module.exports = checkServer
