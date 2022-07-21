/**
 * @format
 */

import './shim'
import '@zxing/text-encoding'

import { AppRegistry, Platform } from 'react-native';
import BackgroundFetch from 'react-native-background-fetch'
import App from './src/App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);

try {

  // Initialize daily checks for data.

  if (Platform.OS === 'android') {
    // Note that I tried putting this in App.tsx but encountered an error: "No task registered for key EndorserDailyTask"
    // My guess is that's not a critical error, and it's just the background task complaining on the first run... but I figured it's safer to just run here and avoid having that error show.
    // It would be nice to force that background task initialization to start later (or not run while the app is in the foreground, see https://stackoverflow.com/questions/72929861/how-do-i-set-headlessjstaskconfig-to-not-run-if-the-app-is-running-in-the-foregr).

    AppRegistry.registerHeadlessTask(
      'EndorserDailyTask', // also referenced in DailyTaskWorker.java
      () => require('./src/utility/backgroundTask')
    );
    console.log('Daily background task is set up.')

  } else if (Platform.OS === 'ios') {

    const PROC_TASK_ID = 'com.transistorsoft.ch.endorser.mobile.daily_task'
    const onEvent = async (taskId) => {  // <-- Event callback
      console.log("[BackgroundFetch] Received custom task", taskId)
      const task = require('./src/utility/backgroundTask')
      const type = taskId === PROC_TASK_ID ? 'proc' : taskId
      await task({ type: type })
      BackgroundFetch.finish(taskId)
    }
    const onTimeout = async (taskId) => {  // <-- Task timeout callback
      // This task has exceeded its allowed running-time.
      // You must stop what you're doing and immediately .finish(taskId)
      BackgroundFetch.finish(taskId)
    }
    BackgroundFetch.configure(
      {
        minimumFetchInterval: 15,
      },
      onEvent,
      onTimeout
    )
      .then((status) => {
        console.log('[BackgroundFetch] status', status, BackgroundFetch.STATUS_AVAILABLE, BackgroundFetch.STATUS_RESTRICTED, BackgroundFetch.STATUS_DENIED)
      })
      .then(() => {
        BackgroundFetch.scheduleTask({
          taskId: PROC_TASK_ID,
          delay: 1000 * 60 * 15,  // <-- milliseconds
          periodic: true,
          requiresNetworkConnectivity: true,
        })
      })

  } else {
    console.log('Unrecognized Platform of ' + Platform.OS + ' -- daily background task will not work.')
  }

} catch (e) {

  // If we've failed, we'll want to let the user know. This will be the responsibility of our WorkManager status checks. See taskyaml:endorser.ch,2020/tasks#mobile-android-workmanager-status
  console.log('Got error while initializing daily checks.', e)
}
