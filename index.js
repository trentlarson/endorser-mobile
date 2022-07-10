/**
 * @format
 */

import './shim'
import '@zxing/text-encoding'

import { AppRegistry, Platform } from 'react-native';
import App from './src/App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);

try {

  // Initialize daily checks for data.

  // Note that I tried putting this in App.tsx but encountered an error: "No task registered for key EndorserDailyTask"
  // My guess is that's not a critical error, and it's just the background task complaining on the first run... but I figured it's safer to just run here and avoid having that error show.
  // It would be nice to force that background task initialization to start later (or not run while the app is in the foreground, see https://stackoverflow.com/questions/72929861/how-do-i-set-headlessjstaskconfig-to-not-run-if-the-app-is-running-in-the-foregr).

  if (Platform.OS === 'android') {
    AppRegistry.registerHeadlessTask(
      'EndorserDailyTask', // also referenced in DailyTaskWorker.java
      () => require('./src/utility/backgroundTask')
    );
    console.log('Daily background task is set up.')
  } else if (Platform.OS === 'ios') {
    console.log('Daily background task not yet working on iOS.')
  } else {
    console.log('Unrecognized Platform of ' + Platform.OS + ' -- daily background task will not work.')
  }

} catch (e) {

  // If we've failed, we'll want to let the user know. This will be the responsibility of our WorkManager status checks. See taskyaml:endorser.ch,2020/tasks#mobile-android-workmanager-status
  console.log('Got error while initializing daily checks.', e)
}
