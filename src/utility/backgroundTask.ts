
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

      const endorserApiServer = DEFAULT_ENDORSER_API_SERVER

      const agentIdentifiers = await agent.didManagerFind()
      const id0 = agentIdentifiers[0] // type is @veramo/core IIdentifier

      let allResults: Array<utility.EndorserRecord> = []
      let maybeMoreAfter = settings.latestNotifiedClaimId
      do {
        let nextResults = await moreTransactions(endorserApiServer, id0, maybeMoreAfter)
        if (nextResults.data) {
          allResults = allResults.concat(nextResults.data)
          maybeMoreAfter = nextResults.maybeMoreAfter
        }
      } while (maybeMoreAfter)

      const latestClaimId = allResults[allResults.length - 1].id
      if (latestClaimId !== settings.latestNotifiedClaimId) {

        await notifee.displayNotification({
          title: 'New Endorser Claims',
          body: 'There are ' + allResults.length + ' new claims.',
          android: {
            channelId: utility.DEFAULT_ANDROID_CHANNEL_ID,
            pressAction: {
              id: 'default', // launch the application on press
            }
            //smallIcon: 'name-of-a-small-icon', // optional, defaults to 'ic_launcher'.
          },
        });

        settings.latestNotifiedClaimId = latestClaimId
        await conn.manager.save(Settings, settings)
      }
    }

    console.log('Finished background JavaScript.')
  } catch (e) {
    console.log('Got error in background JavaScript', e)
  }

}
