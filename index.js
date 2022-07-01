/**
 * @format
 */

import './shim'
import '@zxing/text-encoding'

import notifee from '@notifee/react-native';
import {AppRegistry} from 'react-native';
import BackgroundFetch from "react-native-background-fetch"

import {name as appName} from './app.json';
import App from './src/App';
import { appSlice, appStore } from './src/veramo/appSlice'

AppRegistry.registerComponent(appName, () => App);

// Create a channel
const channelCreate = notifee.createChannel({
  id: 'background-channel',
  name: 'Background Channel',
});

// See "MUST BE IN index.js" in https://www.npmjs.com/package/react-native-background-fetch#config-boolean-enableheadless-false
const MyHeadlessTask = async (event) => {
  console.log('Running initBackgroundFetch')
  appStore.dispatch(appSlice.actions.setStartupTime(new Date().toISOString()))

  if (event.timeout) {
    BackgroundFetch.finish(event.taskId)
  }

  const channelId = await channelCreate;

  // Display a notification
  const displayNote = await notifee.displayNotification({
    title: 'Notification from Background',
    body: 'Created in the background at ' + new Date().toISOString(),
    android: {
      channelId,
      //smallIcon: 'name-of-a-small-icon', // optional, defaults to 'ic_launcher'.
    },
  });

  BackgroundFetch.finish(event.taskId)
}

// returns undefined
BackgroundFetch.registerHeadlessTask(MyHeadlessTask)
