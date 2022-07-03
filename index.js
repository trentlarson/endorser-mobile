/**
 * @format
 */

import './shim'
import '@zxing/text-encoding'

import {AppRegistry} from 'react-native';

import App from './src/App';
import {name as appName} from './app.json';
import { checkClaims } from './src/utility/utilityPlus'

AppRegistry.registerComponent(appName, () => App);

AppRegistry.registerHeadlessTask('EndorserFireDaily', () => async (data) => checkClaims(data));
