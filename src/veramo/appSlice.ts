import * as R from 'ramda'
import { configureStore, createSlice } from '@reduxjs/toolkit'
import { IIdentifier } from "@veramo/core"

import { Contact } from '../entity/contact'
import { Settings } from '../entity/settings'
import * as utility from '../utility/utility'

const MAX_LOG_LENGTH = 2000000

export const DEFAULT_ENDORSER_API_SERVER = 'https://endorser.ch:3000'
export const DEFAULT_ENDORSER_VIEW_SERVER = 'https://endorser.ch'
export const LOCAL_ENDORSER_API_SERVER = 'http://127.0.0.1:3000'
export const LOCAL_ENDORSER_VIEW_SERVER = 'http://127.0.0.1:3001'
export const TEST_ENDORSER_API_SERVER = 'https://test.endorser.ch:8000'
export const TEST_ENDORSER_VIEW_SERVER = 'https://test.endorser.ch:8080'

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

    // This is nullable because it is cached state from the DB...
    // it'll be null if we haven't even loaded from the DB yet.
    settings: null as Settings,

    // This is nullable because it is cached state from the DB...
    // it'll be null if we haven't even loaded from the DB yet.
    identifiers: null as Array<IIdentifier> | null,

    // This is nullable because it is cached state from the DB...
    // it'll be null if we haven't even loaded from the DB yet.
    contacts: null as Array<Contact> | null,

    apiServer: DEFAULT_ENDORSER_API_SERVER,
    viewServer: DEFAULT_ENDORSER_VIEW_SERVER,

    logMessage: '',

    advancedMode: false,
    testMode: false,

    startupTime: null as string | null,
    lastBackgroundRunTime: null as string | null,

  },
  reducers: {
    addIdentifier: (state, contents: Payload<IIdentifier>) => {
      state.identifiers = state.identifiers.concat([contents.payload])
    },
    addLog: (state, contents: Payload<LogMsg>) => {
      if (state.logMessage.length > MAX_LOG_LENGTH) {
        state.logMessage = "<truncated>\n..." + state.logMessage.substring(state.logMessage.length - (MAX_LOG_LENGTH / 2))
      }
      if (contents.payload.log) {
        state.logMessage += "\n" + contents.payload.msg
      }
    },
    setAdvancedMode: (state, contents: Payload<boolean>) => {
      state.advancedMode = contents.payload
    },
    setApiServer: (state, contents: Payload<string>) => {
      state.apiServer = contents.payload
    },
    setContacts: (state, contents: Payload<Array<Contact>>) => {
      state.contacts = contents.payload
    },
    setContact: (state, contents: Payload<Contact>) => {
      const index = R.findIndex(c => c.did === contents.payload.did, state.contacts)
      state.contacts[index] = contents.payload
    },
    setHomeScreen: (state, contents: Payload<string>) => {
      state.settings.homeScreen = contents.payload
    },
    setIdentifiers: (state, contents: Payload<Array<IIdentifier>>) => {
      state.identifiers = contents.payload
    },
    setLastBackgroundRunTime: (state, contents: Payload<string>) => {
      state.lastBackgroundRunTime = contents.payload
    },
    setSettings: (state, contents: Payload<Settings>) => {
      state.settings = contents.payload
    },
    setStartupTime: (state, contents: Payload<string>) => {
      state.startupTime = contents.payload
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
