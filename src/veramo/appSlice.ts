import { configureStore, createSlice } from '@reduxjs/toolkit';

export interface Identifier {
  did: string
}

// for contents set in reducers
interface Payload<T> {
  type: string;
  payload: T;
}

export const appSlice = createSlice({
  name: 'app',
  initialState: {
    contacts: [],
    apiServer: 'http://10.0.0.88:3000',
    viewServer: 'http://10.0.0.88:3001',
  },
  reducers: {
    setContacts: (state, contents: Payload<Array<Identifier>>) => {
      state.contacts = contents.payload
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
