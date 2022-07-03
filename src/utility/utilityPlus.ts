import notifee from '@notifee/react-native';

import { MASTER_COLUMN_VALUE, Settings } from "../entity/settings"
import { dbConnection } from '../veramo/setup'

// Create a channel
const channelCreation = notifee.createChannel({
  id: 'default-channel',
  name: 'Default Channel',
});

// Check server & display a notification
export const checkClaims = async (data) => {

  const conn = await dbConnection
  await conn.manager.update(Settings, MASTER_COLUMN_VALUE, { latestNotifiedClaimId: new Date().toISOString() })

  const channelId = await channelCreation
  await notifee.displayNotification({
    title: 'New Claims',
    body: 'Note body: ' + JSON.stringify(data),
    android: {
      channelId,
      pressAction: {
        id: 'default', // launch the application on press
      }
      //smallIcon: 'name-of-a-small-icon', // optional, defaults to 'ic_launcher'.
    },
  })

}
