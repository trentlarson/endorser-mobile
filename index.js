/**
 * @format
 */

import './shim'
import '@zxing/text-encoding'

import { AppRegistry, Platform } from 'react-native';
import App from './src/App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);

// Set up daily notifications.
if (Platform.OS === 'android') {
  AppRegistry.registerHeadlessTask(
    'EndorserDailyTask', // also referenced in DailyTaskWorker.java
    () => require('./src/utility/backgroundTask')
  );
  console.log('Daily notifications are set up.')
  //appStore.dispatch(appSlice.actions.addLog({log: true, msg: "Daily notifications are set up."}))
} else if (Platform.OS === 'ios') {
  console.log('Daily notifications are not yet working on iOS.')
  //appStore.dispatch(appSlice.actions.addLog({log: true, msg: "Daily notifications are not yet working on iOS."}))
} else {
  console.log('Unrecognized Platform of ' + Platform.OS + ' -- notifications will not work.')
  //appStore.dispatch(appSlice.actions.addLog({log: true, msg: 'Unrecognized Platform of ' + Platform.OS + ' -- notifications will not work.'}))
}
