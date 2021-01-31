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
  initialState: { contacts: [] },
  reducers: {
    setIdentifiers: (state, contents: Payload<Array<Identifier>>) => {
      state.contacts = contents.payload
    }
  }
})

export const appStore = configureStore({ reducer: appSlice.reducer})
