import { classToPlain } from 'class-transformer'
import * as Papa from 'papaparse'
import * as R from 'ramda'
import React, { useState } from 'react'
import { ActivityIndicator, Button, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import Clipboard from '@react-native-community/clipboard'
import { useFocusEffect } from '@react-navigation/native'
import { useSelector } from 'react-redux'

import { Contact } from '../entity/contact'
import * as utility from '../utility/utility'
import { appSlice, appStore } from '../veramo/appSlice'
import { agent, dbConnection } from '../veramo/setup'

export function ContactsScreen({ navigation, route }) {

  const [contactDid, setContactDid] = useState<string>()
  const [contactName, setContactName] = useState<string>()
  const [contactPubKeyBase64, setContactPubKeyBase64] = useState<string>()
  const [identifiers, setIdentifiers] = useState<Identifier[]>([])
  const [loadingAction, setLoadingAction] = useState<Record<string,boolean>>({})

  const allContacts = useSelector((state) => state.contacts || [])

  const setContactInState = async (contact) => {
    const newContactEntity = new Contact()
    // fill in with contact info
    Object.assign(newContactEntity, contact)
    const conn = await dbConnection
    await conn.manager.save(newContactEntity)

    appStore.dispatch(appSlice.actions.setContact(classToPlain(contact)))
  }

  const copyToClipboard = () => {
    Clipboard.setString(Papa.unparse(allContacts))
  }

  const createContact = async () => {
    const contact = new Contact()
    contact.did = contactDid
    contact.name = contactName
    contact.pubKeyBase64 = contactPubKeyBase64
    //the seesMe value is unknown

    const conn = await dbConnection
    let newContact = await conn.manager.save(contact)
    utility.loadContacts(appSlice, appStore, dbConnection)
  }

  const checkVisibility = async (contact) => {
    setLoadingAction(R.set(R.lensProp(contact.did), true, loadingAction))
    const endorserApiServer = appStore.getState().apiServer
    const token = await utility.accessToken(identifiers[0])
    fetch(endorserApiServer + '/api/report/canDidExplicitlySeeMe?did=' + contact.did, {
      headers: {
        "Content-Type": "application/json",
        "Uport-Push-Token": token,
      }
    }).then(response => {
      if (response.status !== 200) {
        throw Error('There was an error from the server trying to check visibility.')
      }
      return response.json()
    }).then(result => {
      setLoadingAction(R.set(R.lensProp(contact.did), false, loadingAction))

      const newContact = R.clone(contact)
      newContact.seesMe = result
      setContactInState(newContact)
    })
  }

  const allowToSeeMe = async (contact) => {
    setLoadingAction(R.set(R.lensProp(contact.did), true, loadingAction))
    const endorserApiServer = appStore.getState().apiServer
    const token = await utility.accessToken(identifiers[0])
    fetch(endorserApiServer + '/api/report/canSeeMe', {
      method: 'POST',
      headers: {
        "Content-Type": "application/json",
        "Uport-Push-Token": token,
      },
      body: JSON.stringify({ did: contact.did })
    }).then(response => {
      setLoadingAction(R.set(R.lensProp(contact.did), false, loadingAction))
      if (response.status !== 200) {
        throw Error('There was an error from the server trying to set you as visible.')
      } else {
        const newContact = R.clone(contact)
        newContact.seesMe = true
        setContactInState(newContact)
      }
    })
  }

  const disallowToSeeMe = async (contact) => {
    setLoadingAction(R.set(R.lensProp(contact.did), true, loadingAction))
    const endorserApiServer = appStore.getState().apiServer
    const token = await utility.accessToken(identifiers[0])
    fetch(endorserApiServer + '/api/report/cannotSeeMe', {
      method: 'POST',
      headers: {
        "Content-Type": "application/json",
        "Uport-Push-Token": token,
      },
      body: JSON.stringify({ did: contact.did })
    }).then(response => {
      setLoadingAction(R.set(R.lensProp(contact.did), false, loadingAction))
      if (response.status !== 200) {
        throw Error('There was an error from the server trying to hide you.')
      } else {
        const newContact = R.clone(contact)
        newContact.seesMe = false
        setContactInState(newContact)
      }
    })
  }

  const deleteFirstContact = async () => {
    if (allContacts.length > 0) {
      const first = allContacts[0]
      const conn = await dbConnection
      await conn.manager.delete(Contact, { 'did' : first.did })
      utility.loadContacts(appSlice, appStore, dbConnection)
    }
  }

  const deleteContact = async (did) => {
    const conn = await dbConnection
    await conn.manager.delete(Contact, { 'did' : did })
    utility.loadContacts(appSlice, appStore, dbConnection)
  }

  useFocusEffect(
    React.useCallback(() => {

      agent.didManagerFind().then(ids => setIdentifiers(ids))

      utility.loadContacts(appSlice, appStore, dbConnection)

    }, [])
  )

  return (
    <SafeAreaView>
      <ScrollView>
        <View style={{ padding: 20 }}>
          <Text style={{ fontSize: 30, fontWeight: 'bold' }}>Contacts</Text>
          <View style={{ padding: 20 }}>
            <Button
              title="Scan to Import"
              onPress={() => navigation.navigate('Contact Import')}
            />
          </View>
          <View style={{ alignItems: "center" }}>
            <Text>or enter by hand:</Text>
          </View>
          <View>
            <Text>Name (optional)</Text>
            <TextInput
              value={contactName}
              onChangeText={setContactName}
              editable
              style={{ borderWidth: 1 }}
              autoCapitalize={'words'}
            />
            <Text>DID</Text>
            <TextInput
              value={contactDid}
              onChangeText={setContactDid}
              editable
              style={{ borderWidth: 1 }}
              autoCapitalize={'none'}
              autoCorrect={false}
            />
            <Text>Public Key (base64-encoded, optional)</Text>
            <TextInput
              value={contactPubKeyBase64}
              onChangeText={setContactPubKeyBase64}
              editable
              style={{ borderWidth: 1 }}
              autoCapitalize={'none'}
              autoCorrect={false}
            />
          </View>
          <View style={{ alignItems: "center" }}>
            <Button
              style={{ alignItems: "center" }}
              title='Create'
              onPress={createContact}
            />
          </View>
        </View>
        { appStore.getState().testMode
          ? <View style={{ marginTop: 5 }}>
              <Button
                title="Delete First Contact"
                onPress={deleteFirstContact}
              />
            </View>
          : <View/>
        }
        <View style={{ padding: 10 }}>
          { allContacts && allContacts.length > 0
            ? <View>
                <View style={{ backgroundColor: 'rgba(0,0,0,0.9)', height: 0.8, width: '100%' }}/>
                <Text>All Contacts</Text>
                <Button title="Copy All to Clipboard (CSV)" onPress={copyToClipboard} />
              </View>
            : <View/>
          }
          { allContacts.map((contact, index) => (
            <View style={{ borderWidth: 1 }} key={contact.did}>
              <View style={{ padding: 20 }}>
                <Text style={{ fontSize: 11 }} selectable={ true }>
                  { (contact.name || '(no name)')
                    + '\n' + contact.did
                    + '\n' + (contact.pubKeyBase64 || '(no public key)')}
                </Text>
                {
                  loadingAction[contact.did]
                  ? <ActivityIndicator color="#00ff00" />
                  : <View style={styles.centeredView}>
                    {
                      R.isNil(contact.seesMe)
                      ?
                        <View>
                          <Button style={{ textAlign: 'center' }}
                            title={`Can ${contact.name || 'They'} See My Activity?`}
                            onPress={() => {checkVisibility(contact)}}
                          />
                          <Button
                            title="Make Me Visible"
                            onPress={() => {allowToSeeMe(contact)}}
                          />
                        </View>
                      :
                        <View>
                          <Text style={{ textAlign: 'center' }}>
                            { `${contact.name} can${contact.seesMe ?'' : 'not'} see your activity.` }
                          </Text>
                          {
                            contact.seesMe
                            ? <Button
                              title="Hide Me"
                              onPress={() => {disallowToSeeMe(contact)}}
                            />
                            : <Button
                              title="Make Me Visible"
                              onPress={() => {allowToSeeMe(contact)}}
                            />
                          }
                          <Button
                            title={`(Double-Check Visibility)`}
                            onPress={() => {checkVisibility(contact)}}
                          />
                        </View>
                    }
                    { appStore.getState().testMode
                      ? <View><Button title={'Delete'} onPress={() => deleteContact(contact.did)}/></View>
                      : <View/>
                    }
                  </View>
                }
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 22
  },
})
