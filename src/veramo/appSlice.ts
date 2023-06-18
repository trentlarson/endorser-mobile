import * as R from 'ramda'
import { configureStore, createSlice } from '@reduxjs/toolkit'
import { IIdentifier } from "@veramo/core"

import { Contact } from '../entity/contact'
import { Settings } from '../entity/settings'

const MAX_LOG_LENGTH = 2000000
const BVC_PROJECT_CLAIM_ID = 'https://endorser.ch/entity/01GXYPFF7FA03NXKPYY142PY4H'

export const DEFAULT_ENDORSER_API_SERVER = 'https://endorser.ch:3000'
export const DEFAULT_ENDORSER_VIEW_SERVER = 'https://endorser.ch'
export const LOCAL_ENDORSER_API_SERVER = 'http://127.0.0.1:3000'
export const LOCAL_ENDORSER_VIEW_SERVER = 'http://127.0.0.1:3001'
export const TEST_ENDORSER_API_SERVER = 'https://test.endorser.ch:8000'
export const TEST_ENDORSER_VIEW_SERVER = 'https://test.endorser.ch:8080'

export interface AppState {
  // This is nullable because it is cached state from the DB...
  // it'll be null if we haven't even loaded from the DB yet.
  settings: Settings | null;

  // This is nullable because it is cached state from the DB...
  // it'll be null if we haven't even loaded from the DB yet.
  identifiers: Array<IIdentifier> | null;

  // This is nullable because it is cached state from the DB...
  // it'll be null if we haven't even loaded from the DB yet.
  contacts: Array<Contact> | null;

  homeProjectId: string;
  homeScreen: string; // array of home screen IDs, JSON-ified
  logMessage: string;
  refreshHomeFeed: boolean;
  viewServer: string;
  advancedMode: boolean;
  testMode: boolean;
}

// for contents set in reducers
interface Payload<T> {
  type: string;
  payload: T;
}

interface LogMsg {
  log: boolean;
  msg: string;
}

export const appSlice = createSlice({
  name: 'app',
  initialState: {

    settings: null as Settings | null,

    identifiers: null as Array<IIdentifier> | null,

    contacts: null as Array<Contact> | null,

    homeProjectId: BVC_PROJECT_CLAIM_ID,

    logMessage: '',

    refreshHomeFeed: false,

    viewServer: DEFAULT_ENDORSER_VIEW_SERVER,

    advancedMode: false,
    testMode: false,
  } as AppState,
  reducers: {
    addIdentifier: (state, contents: Payload<IIdentifier>) => {
      state.identifiers = state.identifiers.concat([contents.payload])
    },
    addLog: (state, contents: Payload<LogMsg>) => {
      if (state.logMessage.length > MAX_LOG_LENGTH) {
        state.logMessage = "<truncated>\n..." + state.logMessage.substring(state.logMessage.length - (MAX_LOG_LENGTH / 2))
      }
      if (contents.payload.log) {
        console.log(contents.payload.msg)
        state.logMessage += "\n" + contents.payload.msg
      }
    },
    setAdvancedMode: (state, contents: Payload<boolean>) => {
      state.advancedMode = contents.payload
    },
    setContacts: (state, contents: Payload<Array<Contact>>) => {
      state.contacts = contents.payload
    },
    setContact: (state, contents: Payload<Contact>) => {
      const index = R.findIndex(c => c.did === contents.payload.did, state.contacts)
      state.contacts[index] = contents.payload
    },
    setHomeProjectId: (state, contents: Payload<string>) => {
      state.homeProjectId = contents.payload
    },
    setHomeScreen: (state, contents: Payload<string>) => {
      state.settings.homeScreen = contents.payload
    },
    setIdentifiers: (state, contents: Payload<Array<IIdentifier>>) => {
      state.identifiers = contents.payload
    },
    setLastDailyTaskTime: (state) => {
      state.settings.lastDailyTaskTime = new Date().toISOString()
    },
    setRefreshHomeFeed: (state, contents: Payload<boolean>) => {
      state.refreshHomeFeed = contents.payload
    },
    setSettings: (state, contents: Payload<Settings>) => {
      state.settings = contents.payload
    },
    setTestMode: (state, contents: Payload<boolean>) => {
      state.testMode = contents.payload
    },
    setViewServer: (state, contents: Payload<string>) => {
      state.viewServer = contents.payload
    },
  }
})

export const appStore = configureStore({ reducer: appSlice.reducer})
