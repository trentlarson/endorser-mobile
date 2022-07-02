/**
 * @format
 */

import './shim'
import '@zxing/text-encoding'

import notifee from '@notifee/react-native';
import {AppRegistry} from 'react-native';

import App from './src/App';
import {name as appName} from './app.json';

AppRegistry.registerComponent(appName, () => App);

// Create a channel
const channelCreation = notifee.createChannel({
  id: 'default-channel',
  name: 'Default Channel',
});

// Display a notification
const notify = async (data) => {
  const channelId = await channelCreation
  await notifee.displayNotification({
    title: 'New Claims',
    body: 'Note body: ' + JSON.stringify(data),
    android: {
      channelId,
      //smallIcon: 'name-of-a-small-icon', // optional, defaults to 'ic_launcher'.
    },
  })
}

AppRegistry.registerHeadlessTask('EndorserFireDaily', () => async (data) => notify(data));
