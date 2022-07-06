/**
 * @format
 */

import './shim'
import '@zxing/text-encoding'

import {AppRegistry} from 'react-native';
import App from './src/App';
import {name as appName} from './app.json';

AppRegistry.registerComponent(appName, () => App);

//AppRegistry.registerComponent("DailyClaimCheck", () => console.log('Yep, I am JavaScript inside index.js'));
AppRegistry.registerComponent('utilityPlus', () => require('./src/utility/utilityPlus'));
