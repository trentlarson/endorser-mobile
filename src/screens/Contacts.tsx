import { classToPlain } from 'class-transformer'
import * as Papa from 'papaparse'
import * as R from 'ramda'
import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Button, Modal, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableHighlight, View } from 'react-native'
import Clipboard from '@react-native-community/clipboard'
import { CheckBox } from 'react-native-elements'
import { useFocusEffect } from '@react-navigation/native'
import { useSelector } from 'react-redux'

import { styles } from './style'
import { Contact } from '../entity/contact'
import * as utility from '../utility/utility'
import { appSlice, appStore, DEFAULT_ENDORSER_API_SERVER, DEFAULT_ENDORSER_VIEW_SERVER } from '../veramo/appSlice'
import { agent, dbConnection } from '../veramo/setup'

export function ContactsScreen({ navigation, route }) {

  const [confirmDeleteContact, setConfirmDeleteContact] = useState<string>(null)
  const [contactDid, setContactDid] = useState<string>()
  const [contactName, setContactName] = useState<string>()
  const [contactPubKeyBase64, setContactPubKeyBase64] = useState<string>()
  const [contactsCsvText, setContactsCsvText] = useState<string>('')
  const [contactsCsvUrl, setContactsCsvUrl] = useState<string>('')
  const [contactUrl, setContactUrl] = useState<string>('')
  const [editContactIndex, setEditContactIndex] = useState<number>(null)
  const [editContactName, setEditContactName] = useState<string>(null)
  const [finishedImport, setFinishedImport] = useState<boolean>(false)
  const [id0, setId0] = useState<Identifier>()
  const [inputContactData, setInputContactData] = useState<boolean>(false)
  const [inputContactUrl, setInputContactUrl] = useState<boolean>(false)
  const [loadingAction, setLoadingAction] = useState<Record<string,boolean>>({})
  const [quickMessage, setQuickMessage] = useState<string>(null)
  const [scannedImport, setScannedImport] = useState<string>(route.params && route.params.scannedDatum)
  const [scannedImportHandled, setScannedImportHandled] = useState<boolean>(false)
  const [wantsToBeVisible, setWantsToBeVisible] = useState<boolean>(true)
  const [wantsCsvText, setWantsCsvText] = useState<boolean>(false)
  const [wantsCsvUrl, setWantsCsvUrl] = useState<boolean>(false)

  // these are tracking progress when saving data
  const [csvErrors, setCsvErrors] = useState<Array<string>>([])
  const [csvMessages, setCsvMessages] = useState<Array<string>>([])
  const [doneSavingStoring, setDoneSavingStoring] = useState<boolean>()
  const [saving, setSaving] = useState<boolean>(false)
  const [storingVisibility, setStoringVisibility] = useState<boolean>(false)
  const [visibilityError, setVisibilityError] = useState<boolean>(false)

  const allIdentifiers = useSelector((state) => state.identifiers || [])
  const allContacts = useSelector((state) => state.contacts || [])

  let contactFields = [];
  const sampleContact = new Contact()
  for (let field in sampleContact) {
    if (sampleContact.hasOwnProperty(field)) {
      contactFields = R.concat(contactFields, [field])
    }
  }

console.log('route.params',route.params)
console.log('scannedImport',scannedImport)
  //let scannedDatum: string = null // whatever was scanned, typically a URL
  if (route.params && route.params.scannedDatum && !scannedImport) {
    //scannedDatum = route.params.scannedDatum
    setScannedImport(route.params.scannedDatum)
  }
/**
**/

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

  const saveContactName = async (contactIndex, contactName) => {
    setEditContactIndex(null)
    setEditContactName(null)

    const contact = allContacts[contactIndex]
    const newContact = R.set(R.lensProp('name'), contactName, contact)
    const result = saveContact(newContact)
    appStore.dispatch(appSlice.actions.setContact(newContact))
    return result
  }

  const createContact = async () => {
    let contact = new Contact()
    if (contactUrl != null && contactUrl != '') {
      const conInfo = utility.getContactPayloadFromJwtUrl(contactUrl)
      contact.did = conInfo.iss
      contact.name = conInfo.own.name
      contact.pubKeyBase64 = conInfo.own.publicEncKey
      setContactUrl(null)
    } else if (contactDid != null && contactDid != '') {
      contact.did = contactDid
      contact.name = contactName
      contact.pubKeyBase64 = contactPubKeyBase64
      setContactDid(null)
      setContactName(null)
      setContactPubKeyBase64(null)
    } else {
      Alert.alert("There must be a URL or a DID to create a contact.");
      return
    }
    await saveContact(contact)
    setQuickMessage('Added ' + (contact.name ? contact.name : '(but without a name)'))
    setTimeout(() => { setQuickMessage(null) }, 2000)
    return utility.loadContacts(appSlice, appStore, dbConnection)
  }

  const createContactFromData = async (did, name, pubKey) => {
    if (contactDid) {
      const contact = new Contact()
      contact.did = did
      contact.name = name
      contact.pubKeyBase64 = pubKey
      return saveContact(contact)
    } else {
      Alert.alert("There must be a DID to create a contact.");
    }
  }

  const createContactFromDataState = async () => {
    return createContactFromData(contactDid, contactName, contactPubKeyBase64)
    .then((result) => {
      if (result) {
        setQuickMessage('Added ' + (contactName ? contactName : '(but without a name)'))
        setTimeout(() => { setQuickMessage(null) }, 2000)
        utility.loadContacts(appSlice, appStore, dbConnection)
      }
    })
    .finally(() => {
      setContactDid(null)
      setContactName(null)
      setContactPubKeyBase64(null)
      setInputContactData(false)
    })
  }

  const createContactFromUrl = async (url) => {
    if (url != null && url != '') {
      const contact = new Contact()
      const conInfo = utility.getContactPayloadFromJwtUrl(url)
      contact.did = conInfo.iss
      contact.name = conInfo.own && conInfo.own.name
      contact.pubKeyBase64 = conInfo.own && conInfo.own.publicEncKey
      return saveContact(contact)
    } else {
      Alert.alert("There must be a URL to create a contact.");
    }
  }

  const createContactFromUrlState = async () => {
    return createContactFromUrl(contactUrl)
    .then((result) => {
console.log('got result', result)
      if (result) {
console.log('got real result')
        setQuickMessage('Added ' + (result.name ? result.name : '(but without a name)'))
        setTimeout(() => { setQuickMessage(null) }, 2000)
        utility.loadContacts(appSlice, appStore, dbConnection)
      }
    })
    .finally(() => {
      setContactUrl(null)
      setInputContactUrl(false)
    })
  }

  const createContactsFromThisCsvText = async (csvText) => {
    setSaving(true)

    let contacts: Array<Contact> = []
    let messages: Array<string> = []
    let showingTrimmedMessage = false
    const parsed = Papa.parse(csvText, {dynamicTyping: true, skipEmptyLines: true})
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
    .catch((err) => {
      setCsvErrors(R.concat(messages, ['Got an error saving contacts: ' + err]))
    })
  }

  const createContactsFromCsvTextInput = async () => {
    await createContactsFromThisCsvText(contactsCsvText)
    setContactsCsvText(null)
    setWantsCsvText(null)
  }

  const createContactsFromThisCsvUrl = async (url) => {
    setSaving(true)

    return fetch(url)
    .then(response => {
      if (response.status !== 200) {
        throw Error('There was an error from the server trying to retrieve contacts.')
      }
      return response.text()
    }).then(result => {
      return createContactsFromThisCsvText(result)
    })
    .catch((err) => {
      setCsvErrors(['Got an error retrieving contacts: ' + err])
    })

  }

  const createContactsFromCsvUrlInput = async () => {
    await createContactsFromThisCsvUrl(contactsCsvUrl)
    setContactsCsvUrl(null)
    setWantsCsvUrl(null)
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

  const deleteContact = async (did) => {
    const conn = await dbConnection
    await conn.manager.delete(Contact, { 'did' : did })
    utility.loadContacts(appSlice, appStore, dbConnection)
  }

  useFocusEffect(
    React.useCallback(() => {
      setId0(allIdentifiers[0])
      utility.loadContacts(appSlice, appStore, dbConnection)
    }, [])
  )

  useFocusEffect(
    React.useCallback(() => {
    if (scannedImport) {
      if (scannedImport.indexOf(utility.ENDORSER_JWT_URL_LOCATION)) {
        // contact info is embedded in the URL
        const contactPayload = utility.getContactPayloadFromJwtUrl(scannedImport)
        setContactDid(contactPayload.iss)
        setContactName(contactPayload.own && contactPayload.own.name)
        setContactPubKeyBase64(contactPayload.own && contactPayload.own.publicEncKey)
        setInputContactData(true)
      } else {
        // retrieve from the URL and try to extract
        Alert.alert("Not implemented")
      }
      //setScannedImport(null)
    }
    }, [scannedImport])
  )

  useEffect(() => {
console.log('got scannedImport',scannedImport,'ask?',!!scannedImport)
    if (scannedImport) {
      if (scannedImport.indexOf(utility.ENDORSER_JWT_URL_LOCATION)) {
        // contact info is embedded in the URL
        const contactPayload = utility.getContactPayloadFromJwtUrl(scannedImport)
        setContactDid(contactPayload.iss)
        setContactName(contactPayload.own && contactPayload.own.name)
        setContactPubKeyBase64(contactPayload.own && contactPayload.own.publicEncKey)
        setInputContactData(true)
      } else {
        // retrieve from the URL and try to extract
        Alert.alert("Not implemented")
      }
      //setScannedImport(null)
    }
  }, [])
/**
  useEffect(() => {
    if (scannedDatum && !finishedImport) {
      if (scannedDatum.indexOf(utility.ENDORSER_JWT_URL_LOCATION)) {
        // contact info is embedded in the URL
        const contactPayload = utility.getContactPayloadFromJwtUrl(scannedDatum)
        setContactDid(contactPayload.iss)
        setContactName(contactPayload.own && contactPayload.own.name)
        setContactPubKeyBase64(contactPayload.own && contactPayload.own.publicEncKey)
        setInputContactData(true)
      } else {
        // retrieve from the URL and try to extract
        Alert.alert("Not implemented")
      }
      scannedDatum = null
      setFinishedImport(true)
    }
  }, [scannedImport])
**/


  return (
    <SafeAreaView>
      <ScrollView>
        <View style={{ padding: 10 }}>
          <Text style={{ fontSize: 30, fontWeight: 'bold' }}>
            Contacts
            {
              (appStore.getState().apiServer !== DEFAULT_ENDORSER_API_SERVER
               || appStore.getState().viewServer !== DEFAULT_ENDORSER_VIEW_SERVER)
               ? " - Custom Servers"
               : ""
            }
          </Text>

          {
/**
            scannedDatum
            ?
              <View>
                <View style={{ backgroundColor: 'rgba(0,0,0,0.9)', height: 0.8, width: '100%', padding: 5 }}/>
                <Text>New Contact</Text>
                <Text>{ scannedDatum }</Text>
                {
                  scannedDatum && !finishedImport
                  ?
                    <ActivityIndicator color="#00ff00" />
                  :
                    <View />
                }
              </View>
            :
              <View />
**/
          }

          <View style={{ backgroundColor: 'rgba(0,0,0,0.9)', height: 0.8, width: '100%', padding: 5 }}/>
          <Text>Import</Text>

          <Button
            title="Scan QR Code"
            onPress={() => {
              setTimeout(() => setScannedImportHandled(false), 500)
              navigation.navigate('Contact Import')
            }}
          />

          <View style={{ padding: 5 }} />
          <Button
            style={{ alignItems: "center" }}
            title='Enter Name & ID'
            onPress={() => setInputContactData(true)}
          />

          <View style={{ padding: 5 }} />
          <Button
            style={{ alignItems: "center" }}
            title='Enter Endorser.ch URL'
            onPress={() => setInputContactUrl(true)}
          />

          <View style={{ padding: 5 }} />
          <Button
            title="Import Bulk from CSV Text"
            onPress={setWantsCsvText}
          />

          <View style={{ padding: 5 }} />
          <Button
            title="Import Bulk from URL"
            onPress={setWantsCsvUrl}
          />

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

          <Modal
            animationType="slide"
            transparent={true}
            visible={!!wantsCsvText}
          >
            <View style={styles.centeredView}>
              <View style={styles.modalView}>
                { saving ? (
                  <ActivityIndicator color="#00ff00" />
                ) : (
                  <View>

                    <Text
                      style={styles.modalText}>Enter in CSV format (columns in order)
                      &nbsp;
                      <Text
                        style={{ color: 'blue' }}
                        onPress={() => Alert.alert("Columns are:\n " + contactFields.join(', ') + "\n\nPaste content (because manual newlines don't work as expected).")}>
                        (?)
                      </Text>
                    </Text>

                    <TextInput
                      multiline={true}
                      style={{ borderWidth: 1, height: 100 }}
                      onChangeText={setContactsCsvText}
                      autoCapitalize={'none'}
                      autoCorrect={false}
                    >
                      { contactsCsvText }
                    </TextInput>

                    <CheckBox
                      title={ 'After saving, make my claims visible to all.' }
                      checked={wantsToBeVisible}
                      onPress={() => {setWantsToBeVisible(!wantsToBeVisible)}}
                    />

                    <TouchableHighlight
                      style={styles.saveButton}
                      onPress={() => createContactsFromCsvTextInput()}
                    >
                      <Text>Save</Text>
                    </TouchableHighlight>
                    <View style={{ padding: 5 }}/>
                    <TouchableHighlight
                      style={styles.cancelButton}
                      onPress={() => {
                        setWantsCsvText(false)
                      }}
                    >
                      <Text>Cancel</Text>
                    </TouchableHighlight>
                  </View>
                )}
              </View>
            </View>
          </Modal>

          <Modal
            animationType="slide"
            transparent={true}
            visible={!!wantsCsvUrl}
          >
            <View style={styles.centeredView}>
              <View style={styles.modalView}>
                { saving ? (
                  <ActivityIndicator color="#00ff00" />
                ) : (
                  <View>

                    <Text
                      style={styles.modalText}>Enter URL containing a CSV format
                      &nbsp;
                      <Text
                        style={{ color: 'blue' }}
                        onPress={() => Alert.alert("Columns are:\n " + contactFields.join(', ') + "\n\nPaste content (because manual newlines don't work as expected).")}>
                        (?)
                      </Text>
                    </Text>

                    <TextInput
                      style={{ borderWidth: 1, width: 300 }}
                      onChangeText={setContactsCsvUrl}
                      autoCapitalize={'none'}
                      autoCorrect={false}
                    >
                      { contactsCsvUrl }
                    </TextInput>

                    <CheckBox
                      title={ 'After saving, make my claims visible to all.' }
                      checked={wantsToBeVisible}
                      onPress={() => {setWantsToBeVisible(!wantsToBeVisible)}}
                    />

                    <TouchableHighlight
                      style={styles.saveButton}
                      onPress={() => createContactsFromCsvUrlInput()}
                    >
                      <Text>Save</Text>
                    </TouchableHighlight>
                    <View style={{ padding: 5 }}/>
                    <TouchableHighlight
                      style={styles.cancelButton}
                      onPress={() => {
                        setWantsCsvUrl(false)
                      }}
                    >
                      <Text>Cancel</Text>
                    </TouchableHighlight>
                  </View>
                )}
              </View>
            </View>
          </Modal>

          <Modal
            animationType="slide"
            transparent={true}
            visible={inputContactData}
          >
            <View style={styles.centeredView}>
              <View style={styles.modalView}>
                <Text>Name (optional)</Text>
                <TextInput
                  value={contactName}
                  onChangeText={setContactName}
                  editable
                  style={{ borderWidth: 1, width: 100 }}
                  autoCapitalize={'words'}
                  autoCorrect={false}
                />

                <View style={{ padding: 5 }}/>
                <Text>DID</Text>
                <TextInput
                  value={contactDid}
                  onChangeText={setContactDid}
                  editable
                  style={{ borderWidth: 1, width: 200 }}
                  autoCapitalize={'none'}
                  autoCorrect={false}
                />

                <View style={{ padding: 5 }}/>
                <Text>Public Key (base64-encoded, optional)</Text>
                <TextInput
                  value={contactPubKeyBase64}
                  onChangeText={setContactPubKeyBase64}
                  editable
                  style={{ borderWidth: 1, width: 200 }}
                  autoCapitalize={'none'}
                  autoCorrect={false}
                />

                <TouchableHighlight
                  style={styles.saveButton}
                  onPress={() => createContactFromDataState() }
                >
                  <Text>Save</Text>
                </TouchableHighlight>

                <View style={{ padding: 5 }}/>
                <TouchableHighlight
                  style={styles.cancelButton}
                  onPress={() => { console.log('turning off data'); setInputContactData(false) }}
                >
                  <Text>Cancel</Text>
                </TouchableHighlight>
              </View>
            </View>
          </Modal>

          <Modal
            animationType="slide"
            transparent={true}
            visible={inputContactUrl}
          >
            <View style={styles.centeredView}>
              <View style={styles.modalView}>
                <Text>Paste URL</Text>
                <TextInput
                  value={contactUrl}
                  onChangeText={setContactUrl}
                  autoCapitalize={'none'}
                  autoCorrect={false}
                  editable
                  style={{ borderWidth: 1, width: 200 }}
                />

                <TouchableHighlight
                  style={styles.saveButton}
                  onPress={() => createContactFromUrlState() }
                >
                  <Text>Save</Text>
                </TouchableHighlight>
                <View style={{ padding: 5 }}/>
                <TouchableHighlight
                  style={styles.cancelButton}
                  onPress={() => setInputContactUrl(false) }
                >
                  <Text>Cancel</Text>
                </TouchableHighlight>
              </View>
            </View>
          </Modal>

          <Modal
            animationType="slide"
            transparent={true}
            visible={editContactIndex != null}
          >
            <View style={styles.centeredView}>
              <View style={styles.modalView}>
                <Text>Edit Name</Text>
                <TextInput
                  value={editContactName}
                  onChangeText={setEditContactName}
                  autoCapitalize={'none'}
                  editable
                  placeholder={'Enter Name'}
                  style={{ borderWidth: 1 }}
                />

                <TouchableHighlight
                  style={styles.saveButton}
                  onPress={() => saveContactName(editContactIndex, editContactName) }
                >
                  <Text>Save</Text>
                </TouchableHighlight>
                <View style={{ padding: 5 }}/>
                <TouchableHighlight
                  style={styles.cancelButton}
                  onPress={() => { setEditContactIndex(null) }}
                >
                  <Text>Cancel</Text>
                </TouchableHighlight>
              </View>
            </View>
          </Modal>

          <Modal
            animationType="slide"
            transparent={true}
            visible={!!quickMessage}
          >
            <View style={styles.centeredView}>
              <View style={styles.modalView}>
                <Text>{ quickMessage }</Text>
              </View>
            </View>
          </Modal>

        </View>
        <View style={{ padding: 10 }}>
          { allContacts && allContacts.length > 0
            ? <View>
                <View style={{ backgroundColor: 'rgba(0,0,0,0.9)', height: 0.8, width: '100%', padding: 5 }}/>
                <Text>All Contacts</Text>
                <Button title="Export All to Clipboard (CSV)" onPress={copyToClipboard} />
              </View>
            : <View/>
          }
          { allContacts.map((contact, index) => (
            <View style={{ borderWidth: 1 }} key={contact.did}>
              <View style={{ padding: 20 }}>
                <Text style={{ fontSize: 11 }} selectable={ true }>
                  { contact.name || '(no name)' }
                  &nbsp;
                  <Text
                    style={{ color: 'blue' }}
                    onPress={() => { setEditContactIndex(index); setEditContactName(allContacts[index].name) }}
                  >
                    (edit)
                  </Text>
                </Text>
                <Text style={{ fontSize: 11 }} selectable={ true }>
                  { contact.did }
                </Text>
                <Text style={{ fontSize: 11 }} selectable={ true }>
                  { (contact.pubKeyBase64 || '(no public key)')}
                </Text>
                {
                  loadingAction[contact.did]
                  ? <ActivityIndicator color="#00ff00" />
                  : <View style={styles.centeredView}>
                    {
                      (id0 && contact.did === id0.did)
                      ?
                        <View><Text>You can always see your own activity on the Endorser server.</Text></View>
                      :
                        R.isNil(contact.seesMe)
                        ?
                          <View>
                            <Button style={{ textAlign: 'center' }}
                              title={`Can ${contact.name || 'They'} See Your Activity?`}
                              onPress={() => {checkVisibility(contact)}}
                            />
                            <View style={{ marginTop: 5 }}/>
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
                            <View style={{ marginTop: 5 }}/>
                            <Button
                              title={`(Double-Check Visibility)`}
                              onPress={() => {checkVisibility(contact)}}
                            />
                          </View>
                    }
                    <View style={{ marginTop: 5 }}/>
                    <View><Button title={'Delete'} onPress={() => setConfirmDeleteContact(contact.did)}/></View>
                  </View>
                }
              </View>
            </View>
          ))}

          {/* Note that something similar is in Settings.tsx... almost time to abstract it. */}
          <Modal
            animationType="slide"
            transparent={true}
            visible={!!confirmDeleteContact}
          >
            <View style={styles.centeredView}>
              <View style={styles.modalView}>

                <Text>
                  Are you sure you want to delete this contact? This cannot be undone.

                  {"\n\n"}
                  If they can see your activity, you may want to hide yourself first. (Double-check visibilty to be sure.)

                  { "\n\n" + utility.didInContext(confirmDeleteContact, allIdentifiers, allContacts) }
                </Text>

                <View style={{ padding: 5 }}/>
                <TouchableHighlight
                  style={styles.cancelButton}
                  onPress={() => {
                    deleteContact(confirmDeleteContact)
                    setConfirmDeleteContact(null)
                    setQuickMessage('Deleted')
                    setTimeout(() => { setQuickMessage(null) }, 1500)
                  }}
                >
                  <Text>Yes</Text>
                </TouchableHighlight>

                <View style={{ padding: 5 }}/>
                <TouchableHighlight
                  style={styles.saveButton}
                  onPress={() => {
                    setConfirmDeleteContact(null)
                  }}
                >
                  <Text>No</Text>
                </TouchableHighlight>
              </View>
            </View>
          </Modal>

        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
