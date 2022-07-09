/**
 * @format
 */

import './shim'
import '@zxing/text-encoding'

import {AppRegistry} from 'react-native';
import App from './src/App';
import {name as appName} from './app.json';

AppRegistry.registerComponent(appName, () => App);

AppRegistry.registerHeadlessTask('EndorserDailyTask', () => require('./src/utility/backgroundTask'));
