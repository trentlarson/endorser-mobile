import { classToPlain } from 'class-transformer'
import * as Papa from 'papaparse'
import * as R from 'ramda'
import React, { useState } from 'react'
import { ActivityIndicator, Alert, Button, Modal, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableHighlight, View } from 'react-native'
import Clipboard from '@react-native-community/clipboard'
import { CheckBox } from 'react-native-elements'
import { useFocusEffect } from '@react-navigation/native'
import { useSelector } from 'react-redux'

import { styles } from './style'
import { Contact } from '../entity/contact'
import * as utility from '../utility/utility'
import { appSlice, appStore } from '../veramo/appSlice'
import { agent, dbConnection } from '../veramo/setup'

export function ContactsScreen({ navigation, route }) {

  const [contactDid, setContactDid] = useState<string>()
  const [contactName, setContactName] = useState<string>()
  const [contactPubKeyBase64, setContactPubKeyBase64] = useState<string>()
  const [contactsCsv, setContactsCsv] = useState<string>('')
  const [id0, setId0] = useState<Identifier>()
  const [loadingAction, setLoadingAction] = useState<Record<string,boolean>>({})
  const [wantsToBeVisible, setWantsToBeVisible] = useState<boolean>(true)
  const [wantsCsv, setWantsCsv] = useState<boolean>(false)

  // these are tracking progress when saving data
  const [csvErrors, setCsvErrors] = useState<Array<string>>([])
  const [csvMessages, setCsvMessages] = useState<Array<string>>([])
  const [doneSavingStoring, setDoneSavingStoring] = useState<boolean>()
  const [saving, setSaving] = useState<boolean>(false)
  const [storingVisibility, setStoringVisibility] = useState<boolean>(false)
  const [visibilityError, setVisibilityError] = useState<boolean>(false)

  const allContacts = useSelector((state) => state.contacts || [])

  let contactFields = [];
  const sampleContact = new Contact()
  for (let field in sampleContact) {
    if (sampleContact.hasOwnProperty(field)) {
      contactFields = R.concat(contactFields, [field])
    }
  }

  const clearModalAndRedirect = () => {
    setWantsCsv(false)
  }

  const copyToClipboard = () => {
    Clipboard.setString(Papa.unparse(allContacts))
  }

  const saveContact = async (contact: Contact) => {
    const conn = await dbConnection
    // Weird that I have to specify Contact type since all uses are Entities, but if I don't then it complains in CSV import.
    return conn.manager.save(Contact, contact)
  }

  const saveContacts = async (contacts: Array<Contact>) => {
    const conn = await dbConnection
    return conn.manager.save(Contact, contacts)
  }

  const createContact = async () => {
    const contact = new Contact()
    contact.did = contactDid
    contact.name = contactName
    contact.pubKeyBase64 = contactPubKeyBase64
    await saveContact(contact)
    return utility.loadContacts(appSlice, appStore, dbConnection)
  }

  const createContactsFromCsv = async () => {
    setSaving(true)

    let contacts = []
    let messages = []
    let showingTrimmedMessage = false
    const parsed = Papa.parse(contactsCsv, {dynamicTyping: true, skipEmptyLines: true})
    for (let contactArray of parsed.data) {
      // each contactArray has the fields detected for one row of input
      if (contactArray.length === 0) {
        // quietly skip blank rows
      } else if (contactArray.length === 1 && (contactArray[0] == null || contactArray[0] === '')) {
        // quietly skip empty rows
      } else if (contactArray.length > 1 && contactArray[1] === '') {
        messages = R.concat(messages, ['Skipped empty DID in the row for "' + contactArray[0] + '".'])
      } else if (contactArray[0] === contactFields[0] && messages.length === 0) {
        messages = R.concat(messages, ['Skipped first row with "' + contactFields[0] + '" field of "' + contactFields[0] + '". If you really want to include that, make a header row.'])
      } else {
        const contact = new Contact()
        for (let col = 0; col < contactFields.length; col++) {
          if (col < contactArray.length) {
            let value = contactArray[col]
            if (typeof value === 'string') {
              value = value.trim()
              if (!showingTrimmedMessage && value !== contactArray[col]) {
                messages = R.concat(messages, ['Trimmed whitespace around "' + contactArray[col] + '" in the row for "' + contact.name + '". (Will do this for every value but will not warn about any other instances.)'])
                showingTrimmedMessage = true
              }
            }
            contact[contactFields[col]] = value
          }
        }
        contacts = R.concat(contacts, [contact])
        if (contactArray.length < contactFields.length) {
          messages = R.concat(messages, ['There are fewer than ' + contactFields.length + ' fields in the row for "' + contact.name + '". (Will attempt to save anyway.)'])
        }
        if (contactArray.length > contactFields) {
          messages = R.concat(messages, ['There are more than ' + contactFields.length + ' fields in the row for "' + contact.name + '". (Will attempt to save anyway.)'])
        }
      }
    }
    if (contacts.length === 0) {
      messages = R.concat(messages, ['There were no valid contacts to import.'])
    }

    return saveContacts(contacts)
    .then((savedContacts) => {
      setSaving(false)
      setCsvErrors(messages)
      setCsvMessages(['Saved ' + savedContacts.length + ' contacts.'])
      setWantsCsv(false)
    })
    .then(() => {
      if (wantsToBeVisible) {
        // trigger each of the contacts to save visibility
        return Promise.all(contacts.map((contact) => allowToSeeMe(contact)))
      }
    })
    .then(() => {
      return utility.loadContacts(appSlice, appStore, dbConnection)
    })

  }

  /**
    similar to allowToSeeMe & disallowToSeeMe
   */
  const checkVisibility = async (contact: Contact) => {
    setLoadingAction(R.set(R.lensProp(contact.did), true, loadingAction))
    const endorserApiServer = appStore.getState().apiServer
    const token = await utility.accessToken(id0)
    return fetch(endorserApiServer + '/api/report/canDidExplicitlySeeMe?did=' + contact.did, {
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

      // contact.seesMe = ... silently fails
      const newContact = R.set(R.lensProp('seesMe'), result, contact)
      return saveContact(newContact)
    })
    .then(() => {
      return utility.loadContacts(appSlice, appStore, dbConnection)
    })
  }

  /**
    similar to disallowToSeeMe & checkVisibility
   */
  const allowToSeeMe = async (contact: Contact) => {
    setLoadingAction(R.set(R.lensProp(contact.did), true, loadingAction))
    const endorserApiServer = appStore.getState().apiServer
    const token = await utility.accessToken(id0)
    return fetch(endorserApiServer + '/api/report/canSeeMe', {
      method: 'POST',
      headers: {
        "Content-Type": "application/json",
        "Uport-Push-Token": token,
      },
      body: JSON.stringify({ did: contact.did })
    }).then(response => {
      setLoadingAction(R.set(R.lensProp(contact.did), false, loadingAction))
      if (response.status !== 200) {
        throw Error('There was an error from the server trying to set you as visible to ' + contact.name)
      } else {
        // contact.seesMe = ... silently fails
        const newContact = R.set(R.lensProp('seesMe'), true, contact)
        return saveContact(newContact)
      }
    })
    .then(() => {
      return utility.loadContacts(appSlice, appStore, dbConnection)
    })
  }

  /**
    similar to allowToSeeMe & checkVisibility
   */
  const disallowToSeeMe = async (contact: Contact) => {
    setLoadingAction(R.set(R.lensProp(contact.did), true, loadingAction))
    const endorserApiServer = appStore.getState().apiServer
    const token = await utility.accessToken(id0)
    return fetch(endorserApiServer + '/api/report/cannotSeeMe', {
      method: 'POST',
      headers: {
        "Content-Type": "application/json",
        "Uport-Push-Token": token,
      },
      body: JSON.stringify({ did: contact.did })
    }).then(response => {
      setLoadingAction(R.set(R.lensProp(contact.did), false, loadingAction))
      if (response.status !== 200) {
        throw Error('There was an error from the server trying to hide you from ' + contact.name)
      } else {
        // contact.seesMe = ... silently fails
        const newContact = R.set(R.lensProp('seesMe'), false, contact)
        return saveContact(newContact)
      }
    })
    .then(() => {
      return utility.loadContacts(appSlice, appStore, dbConnection)
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

      setId0(appStore.getState().identifiers && appStore.getState().identifiers[0])

      utility.loadContacts(appSlice, appStore, dbConnection)

    }, [])
  )

  return (
    <SafeAreaView>
      <ScrollView>
        <View style={{ padding: 10 }}>
          <Text style={{ fontSize: 30, fontWeight: 'bold' }}>Contacts</Text>
          <Button
            title="Scan to Import"
            onPress={() => navigation.navigate('Contact Import')}
          />

          <Button
            title="Import Bulk (CSV)"
            onPress={setWantsCsv}
          />
          <Modal
            animationType="slide"
            transparent={true}
            visible={!!wantsCsv}
            onRequestClose={() => {
              Alert.alert("Modal has been closed.");
            }}
          >
            <View style={styles.centeredView}>
              <View style={styles.modalView}>
                { saving ? (
                  <ActivityIndicator color="#00ff00" />
                ) : (
                  <View>

                    <Text
                      style={styles.modalText}>Enter in CSV format (columns in order)
                      <Text
                        style={{ color: 'blue' }}
                        onPress={() => Alert.alert("Columns are:\n " + contactFields.join(', ') + "\n\nPaste content (because manual newlines don't work as expected).")}>
                        (?)
                      </Text>
                    </Text>

                    <TextInput
                      multiline={true}
                      style={{ borderWidth: 1, height: 100 }}
                      onChangeText={setContactsCsv}
                      autoCapitalize={'none'}
                      autoCorrect={false}
                    >
                      { contactsCsv }
                    </TextInput>

                    <CheckBox
                      title={ 'After saving, make my claims visible to all.' }
                      checked={wantsToBeVisible}
                      onPress={() => {setWantsToBeVisible(!wantsToBeVisible)}}
                    />

                    <TouchableHighlight
                      style={styles.saveButton}
                      onPress={createContactsFromCsv}
                    >
                      <Text>Save</Text>
                    </TouchableHighlight>
                    <View style={{ padding: 5 }}/>
                    <TouchableHighlight
                      style={styles.cancelButton}
                      onPress={() => {
                        setWantsCsv(false)
                      }}
                    >
                      <Text>Cancel</Text>
                    </TouchableHighlight>
                  </View>
                )}
              </View>
            </View>
          </Modal>
          {csvMessages.length > 0 ? (
            <View style={{ marginBottom: 20 }}>
              <Text>{ csvMessages.join("\n") }</Text>
            </View>
          ) : (
            <View />
          )}
          {csvErrors.length > 0 ? (
            <View style={{ marginBottom: 20 }}>
              <Text style={{ color: 'red' }}>Got these messages while parsing the input:</Text>
              <Text>{ "- " + csvErrors.join("\n- ") }</Text>
            </View>
          ) : (
            <View />
          )}

          <View style={{ alignItems: "center", marginTop: 10 }}>
            <Text>... or enter by hand:</Text>
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
            />
            <Text>Public Key (base64-encoded, optional)</Text>
            <TextInput
              value={contactPubKeyBase64}
              onChangeText={setContactPubKeyBase64}
              editable
              style={{ borderWidth: 1 }}
              autoCapitalize={'none'}
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
                            { `${contact.name} can${contact.seesMe ?'' : 'not'} see your activity on the Endorser server.` }
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
