import * as R from 'ramda'
import { configureStore, createSlice } from '@reduxjs/toolkit'

import { Contact } from '../entity/contact'
import * as utility from '../utility/utility'

// for contents set in reducers
interface Payload<T> {
  type: string;
  payload: T;
}

export const appSlice = createSlice({
  name: 'app',
  initialState: {

    // This is nullable because it is cached state from the DB...
    // it'll be null if we haven't even loaded from the DB yet.
    contacts: null as Array<Contact> | null,

    apiServer: utility.DEFAULT_ENDORSER_API_SERVER,
    viewServer: utility.DEFAULT_ENDORSER_VIEW_SERVER,

    logMessage: '',

    testMode: false,
  },
  reducers: {
    addLog: (state, contents: Payload<string>) => {
      state.logMessage += "\n" + contents.payload
    },
    setContacts: (state, contents: Payload<Array<Contact>>) => {
      state.contacts = contents.payload
    },
    setContact: (state, contents: Payload<Contact>) => {
      const index = R.findIndex(c => c.did === contents.payload.did, state.contacts)
      state.contacts[index] = contents.payload
    },
    setApiServer: (state, contents: Payload<string>) => {
      state.apiServer = contents.payload
    },
    setViewServer: (state, contents: Payload<string>) => {
      state.viewServer = contents.payload
    },
    setTestMode: (state, contents: Payload<boolean>) => {
      state.testMode = contents.payload
    },
  }
})

export const appStore = configureStore({ reducer: appSlice.reducer})
