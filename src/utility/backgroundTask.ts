
import notifee from '@notifee/react-native';

import { MASTER_COLUMN_VALUE, Settings } from '../entity/settings'
import * as utility from '../utility/utility'
import { agent, dbConnection } from '../veramo/setup'

const checkServer = (killToggle) => async (taskData) => {
  try {

    const startDate = new Date()

    const conn = await dbConnection
    let settings = await conn.manager.findOne(Settings, MASTER_COLUMN_VALUE)

    if (settings) {

      // first, record that we've started this process
      settings.lastDailyTaskTime = startDate.toISOString()
      await conn.manager.save(Settings, settings)

      // load any new items from the sersver
      const endorserApiServer = settings.apiServer

      const agentIdentifiers = await agent.didManagerFind()
      const id0 = agentIdentifiers[0] // type is @veramo/core IIdentifier

      const afterId = settings.lastNotifiedClaimId
      let newClaimCount = 0
      let lastClaimId = null
      let beforeId = null
      const mustStopTime = startDate.valueOf() + (25 * 1000) // iOS is strict about their 30-second limit
      do {
        const nextResults = !id0 ? {} : await utility.retrieveClaims(endorserApiServer, id0, afterId, beforeId)
        if (nextResults.data) {
          newClaimCount += nextResults.data.length
          // only set lastClaimId the first time through the loop, only if we get results.
          if (lastClaimId == null
              && nextResults.data.length > 0) {
            lastClaimId = nextResults.data[0].id
          }
          beforeId = nextResults.hitLimit ? nextResults.data[nextResults.data.length - 1].id : null

          /**
           // This is my way of running forever and printing output to show that we're running.
           // Yes, it's complicated. But it was fun to write as one self-contained piece inside the loop.
           // To test this, trigger a background check and then terminate it in NotificationPermissions.

          if (beforeId == null) {
            beforeId = '7ZZZZZZZZZZZZZZZZZZZZZZZZ0' // keep it going, with almost-infinite endpoint
          }
          const secMultiplier = 5 // number of seconds before next log message; be sure it's > total/10 (since you've only got 10 increments)
          const lastNumber = Number(beforeId.charAt(25))
          const numSeconds = (lastNumber + 1) * secMultiplier
          if (Date.now() > startDate.valueOf() + numSeconds * 1000) {
            // it's been a few seconds, so report and then bump it up
            console.log('It has been ' + numSeconds + ' seconds.')
            beforeId = '7ZZZZZZZZZZZZZZZZZZZZZZZZ' + (lastNumber + 1)
          }
          **/

        } else {
          // there was probably some error, since we'd expect at least []; anyway, stop
          beforeId = null
        }
      } while (beforeId && Date.now() < mustStopTime && (!killToggle || !killToggle.getToggle()))

      if (killToggle) {
        // reset now that it's done the job of killing our loop
        killToggle.setToggle(false)
      }

      // notify the user if there's anything new
      if (newClaimCount > 0) {
        if (lastClaimId !== settings.lastNotifiedClaimId) {

          notifee.onBackgroundEvent(async () => {}) // without this explicit setting it complains that "no background event handler has been set"... stupid

          const message =
            newClaimCount === 1
            ? 'There is 1 new claim in your feed.'
            : 'There are ' + newClaimCount + ' new claims in your feed.'
          await notifee.displayNotification({
            title: 'New Endorser Claims',
            body: message,
            android: {
              channelId: utility.DEFAULT_ANDROID_CHANNEL_ID,
              pressAction: {
                id: utility.ANDROID_FEED_ACTION, // launch the application on press
              }
              //smallIcon: 'name-of-a-small-icon', // optional, defaults to 'ic_launcher'.
            },
          })

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
    //console.log(e.stack)
    return 'Got error running a background check.'
  }

}

module.exports = checkServer
