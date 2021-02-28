import * as R from 'ramda'
import { configureStore, createSlice } from '@reduxjs/toolkit'

import { Contact } from '../entity/contact'

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

    //apiServer: 'https://endorser.ch:3000',
    //viewServer: 'https://endorser.ch',
    //apiServer: 'http://10.0.0.88:3000',
    //viewServer: 'http://10.0.0.88:3001',
    apiServer: 'http://127.0.0.1:3000',
    viewServer: 'http://127.0.0.1:3001',
    //apiServer: 'http://192.168.43.114:3000',
    //viewServer: 'http://192.168.43.114:3001',
  },
  reducers: {
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
  }
})

export const appStore = configureStore({ reducer: appSlice.reducer})
