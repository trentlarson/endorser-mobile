/**
 * @format
 */

import './shim'
import '@zxing/text-encoding'

import { AppRegistry, Platform } from 'react-native';
import BackgroundFetch from 'react-native-background-fetch'
import App from './src/App';
import { name as appName } from './app.json';
import * as utility from './src/utility/utility'

AppRegistry.registerComponent(appName, () => App);
