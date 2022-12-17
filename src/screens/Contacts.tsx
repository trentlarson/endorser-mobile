import { classToPlain } from 'class-transformer'
import * as didJwt from 'did-jwt'
import * as Papa from 'papaparse'
import * as R from 'ramda'
import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Button, Modal, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableHighlight, View } from 'react-native'
import Clipboard from '@react-native-community/clipboard'
import { CheckBox } from 'react-native-elements'
import QRCode from "react-native-qrcode-svg"
import Icon from 'react-native-vector-icons/FontAwesome'
import { useFocusEffect } from '@react-navigation/native'
import { useSelector } from 'react-redux'

import { styles } from './style'
import { Contact } from '../entity/contact'
import * as utility from '../utility/utility'
import { appSlice, appStore, DEFAULT_ENDORSER_API_SERVER, DEFAULT_ENDORSER_VIEW_SERVER } from '../veramo/appSlice'
import { agent, dbConnection, SERVICE_ID } from '../veramo/setup'

export function ContactsScreen({ navigation, route }) {

  const [confirmDeleteContact, setConfirmDeleteContact] = useState<string>(null)
  const [contactDid, setContactDid] = useState<string>('')
  const [contactName, setContactName] = useState<string>('')
  const [contactPubKeyBase64, setContactPubKeyBase64] = useState<string>('')
  const [contactsCsvText, setContactsCsvText] = useState<string>('')
  const [contactsCsvUrl, setContactsCsvUrl] = useState<string>('')
  const [contactUrl, setContactUrl] = useState<string>('')
  const [editContactIndex, setEditContactIndex] = useState<number>(null)
  const [editContactName, setEditContactName] = useState<string>(null)
  const [finishedImport, setFinishedImport] = useState<boolean>(false)
  const [inputContactData, setInputContactData] = useState<boolean>(false)
  const [inputContactUrl, setInputContactUrl] = useState<boolean>(false)
  const [loadingAction, setLoadingAction] = useState<Record<string,boolean>>({})
  const [loadingAction2, setLoadingAction2] = useState<Record<string,boolean>>({})
  const [myContactUrl, setMyContactUrl] = useState<string>('')
  const [quickMessage, setQuickMessage] = useState<string>('')
  const [scannedImport, setScannedImport] = useState<string>(null)
  const [showMyQr, setShowMyQr] = useState<boolean>(false)
  const [wantsToBeVisible, setWantsToBeVisible] = useState<boolean>(true)
  const [wantsToRegister, setWantsToRegister] = useState<boolean>(true)
  const [wantsCsvText, setWantsCsvText] = useState<boolean>(false)
  const [wantsCsvUrl, setWantsCsvUrl] = useState<boolean>(false)

  // these are tracking progress when saving data
  const [actionErrors, setActionErrors] = useState<Array<string>>([])
  const [csvMessages, setCsvMessages] = useState<Array<string>>([])
  const [doneSavingStoring, setDoneSavingStoring] = useState<boolean>()
  const [saving, setSaving] = useState<boolean>(false)
  const [storingVisibility, setStoringVisibility] = useState<boolean>(false)

  const allIdentifiers = useSelector((state) => state.identifiers || [])
  const allContacts = useSelector((state) => state.contacts || [])

  let contactFields = [];
  const sampleContact = new Contact()
  for (let field in sampleContact) {
    if (sampleContact.hasOwnProperty(field)) {
      contactFields = R.concat(contactFields, [field])
    }
  }

  if (route.params && route.params.scannedDatum && (scannedImport != route.params.scannedDatum)) {
    setScannedImport(route.params.scannedDatum)
    route.params = undefined
  }

  const copyToClipboard = (text) => {
    Clipboard.setString(text)
    setQuickMessage('Copied')
    setTimeout(() => { setQuickMessage(null) }, 1000)
  }

  const copyContactsToClipboard = () => {
    copyToClipboard(Papa.unparse(allContacts))
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
      contact.pubKeyBase64 = utility.checkPubKeyBase64(conInfo.own.publicEncKey)
      setContactUrl(null)
    } else if (contactDid != null && contactDid != '') {
      contact.did = contactDid
      contact.name = contactName
      contact.pubKeyBase64 = utility.checkPubKeyBase64(contactPubKeyBase64)
      setContactDid('')
      setContactName('')
      setContactPubKeyBase64('')
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
      contact.pubKeyBase64 = utility.checkPubKeyBase64(pubKey)
      return saveContact(contact)
    } else {
      Alert.alert("There must be a DID to create a contact.");
    }
  }

  const singleCreateContactFromDataState = async () => {
    return createContactFromData(contactDid, contactName, contactPubKeyBase64)
    .then(async result => {
      if (result) {

        setContactDid('')
        setContactName('')
        setContactPubKeyBase64('')
        setInputContactData(false)

        let resultMessage = null
        let hitError = false
        resultMessage = 'Added ' + (result.name ? result.name : '(but without a name)')
        if (wantsToBeVisible) {
          hitError = await allowToSeeMe(result) || hitError
        }
        if (wantsToRegister) {
          hitError = await register(result) || hitError
        }
        utility.loadContacts(appSlice, appStore, dbConnection)
        resultMessage += hitError ? '\nSee top for other errors.' : ''
        setQuickMessage(resultMessage)
        setTimeout(() => { setQuickMessage(null) }, 2000)
      } else {
        // not sure if contact was created, but spec isn't clear
      }
    })
  }

  const createContactFromUrl = async (url) => {
    if (url != null && url != '') {
      const contact = new Contact()
      const conInfo = utility.getContactPayloadFromJwtUrl(url)
      contact.did = conInfo.iss
      contact.name = conInfo.own && conInfo.own.name
      contact.pubKeyBase64 = conInfo.own && utility.checkPubKeyBase64(conInfo.own.publicEncKey)
      return saveContact(contact)
    } else {
      Alert.alert("There must be a URL to create a contact.");
    }
  }

  const singleCreateContactFromUrlState = async () => {
    return createContactFromUrl(contactUrl)
    .then(async result => {
      if (result) {

        setContactUrl(null)
        setInputContactUrl(false)

        let resultMessage = null
        let hitError = false
        resultMessage = 'Added ' + (result.name ? result.name : '(but without a name)')
        if (wantsToBeVisible) {
          hitError = await allowToSeeMe(result) || hitError
        }
        if (wantsToRegister) {
          hitError = await register(result) || hitError
        }
        utility.loadContacts(appSlice, appStore, dbConnection)
        resultMessage += hitError ? '\nSee top for other errors.' : ''
        setQuickMessage(fullMessage)
        setTimeout(() => { setQuickMessage(null) }, 2000)
      } else {
        // not sure if contact was created, but spec isn't clear
      }
    })
  }

  const createContactsFromThisCsvText = async (csvText) => {

    let messages: Array<string> = []

    try {

      let contacts: Array<Contact> = []
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
                  messages = R.concat(messages, ['Found whitespace around "' + contactArray[col] + '" in the row for "' + contact.name + '". (Trimmed it, and will do this for every value but will not warn about any other instances.)'])
                  showingTrimmedMessage = true
                }
              }
              contact[contactFields[col]] = value
            }
          }
          contact.pubKeyBase64 = utility.checkPubKeyBase64(contact.pubKeyBase64)
          contacts = R.concat(contacts, [contact])
          if (contactArray.length < contactFields.length) {
            messages = R.concat(messages, ['There are fewer than ' + contactFields.length + ' fields in the row for "' + contact.name + '". (Will attempt to save anyway.)'])
          } else if (contactArray.length > contactFields) {
            messages = R.concat(messages, ['There are more than ' + contactFields.length + ' fields in the row for "' + contact.name + '". (Will attempt to save anyway.)'])
          }
        }
      }
      if (contacts.length === 0) {
        messages = R.concat(messages, ['There were no valid contacts to import.'])
      } else {

        await saveContacts(contacts)
          .then((savedContacts) => {
            setCsvMessages(['Saved ' + savedContacts.length + ' contacts.'])
          })
          .then(async () => {
            if (wantsToBeVisible) {
              // trigger each of the contacts to see me
              const visAll = await Promise.all(contacts.map((contact) => allowToSeeMe(contact)))
              if (R.all(x => !!x, visAll)) {
                messages = R.concat(messages, ['Got an error making you visible to some or all contacts.'])
              }
            }
            if (wantsToRegister) {
              // register each of the contacts
              const regAll = await Promise.all(contacts.map((contact) => register(contact)))
              if (R.all(x => !!x, regAll)) {
                messages = R.concat(messages, ['Got an error registering some or all contacts.'])
              }
            }
          })
          .then(() => {
            utility.loadContacts(appSlice, appStore, dbConnection)
          })
          .catch((err) => {
            messages = R.concat(messages, ['Got an error saving contacts: ' + err])
          })
      }
    } catch (e) {
      messages = R.concat(messages, ['Got an error saving contacts: ' + err])
    }

    return {
      messages: messages
    }
  }

  const createContactsFromCsvTextInput = async () => {
    setSaving(true)
    let result = await createContactsFromThisCsvText(contactsCsvText)
    setSaving(false)
    if (result.messages) {
      setActionErrors(errors => R.concat(errors, [result.messages]))
    }
    setContactsCsvText('')
    setWantsCsvText(false)
  }

  const createContactsFromThisCsvUrl = async (url) => {
    return fetch(url, { cache: "no-cache" })
    .then(async response => {
      const text = await response.text()
      if (response.status !== 200) {
        throw Error('There was an error from the server trying to retrieve contacts: ' + text)
      }
      return text
    }).then(async result => {
      const createResult = await createContactsFromThisCsvText(result)
      if (createResult.messages) {
        setActionErrors(errors => R.concat(errors, [createResult.messages]))
      }
    })
    .catch((err) => {
      setActionErrors(errors => R.concat(errors, ['Got an error retrieving contacts: ' + err]))
    })
  }

  const createContactsFromCsvUrlInput = async () => {
    setSaving(true)
    await createContactsFromThisCsvUrl(contactsCsvUrl)
    setSaving(false)
    setContactsCsvUrl('')
    setWantsCsvUrl(false)
  }

  /**
    similar to allowToSeeMe & disallowToSeeMe
   */
  const checkVisibility = async (contact: Contact) => {
    let hitError = false
    setLoadingAction(R.set(R.lensProp(contact.did), true, loadingAction))

    const endorserApiServer = appStore.getState().settings.apiServer
    const token = await utility.accessToken(allIdentifiers[0])
    await fetch(endorserApiServer + '/api/report/canDidExplicitlySeeMe?did=' + encodeURIComponent(contact.did), {
      headers: {
        "Content-Type": "application/json",
        "Uport-Push-Token": token,
      }
    }).then(async response => {
      if (response.status === 200) {
        return response.json()
      } else {
        hitError = true
        const error = await response.text()
        throw Error('There was an error from the server trying to check visibility: ' + error)
      }
    }).then(result => {
      // contact.seesMe = ... silently fails
      const newContact = R.set(R.lensProp('seesMe'), result, contact)
      return saveContact(newContact)
    })
    .then(() => {
      return utility.loadContacts(appSlice, appStore, dbConnection)
    })
    .catch(e => {
      hitError = true
      setActionErrors(errors => R.concat(errors, [e]))
    })

    setLoadingAction(R.set(R.lensProp(contact.did), false, loadingAction))
    return hitError
  }

  const singleCheckVisibility = async (contact: Contact) => {
    const hitError = await checkVisibility(contact)
    if (hitError) {
      setQuickMessage('Visibility Check Error!\nSee messages at the top.')
      setTimeout(() => { setQuickMessage(null) }, 2000)
    }
  }

  /**
    similar to disallowToSeeMe & checkVisibility

    Note that this could be called for one or as part of a bulk call.
   */
  const allowToSeeMe = async (contact: Contact) => {
    let hitError = false
    setLoadingAction(R.set(R.lensProp(contact.did), true, loadingAction))

    const endorserApiServer = appStore.getState().settings.apiServer
    const token = await utility.accessToken(allIdentifiers[0])
    await fetch(endorserApiServer + '/api/report/canSeeMe', {
      method: 'POST',
      headers: {
        "Content-Type": "application/json",
        "Uport-Push-Token": token,
      },
      body: JSON.stringify({ did: contact.did })
    }).then(async response => {
      if (response.status === 200) {
        // contact.seesMe = ... silently fails
        const newContact = R.set(R.lensProp('seesMe'), true, contact)
        return saveContact(newContact)
      } else {
        hitError = true
        await response
        .json()
        .then(result => {
          let message = 'There was an error from the server trying to set you visible to ' + contact.name + '. See log for more info.'
          if (result && result.error && result.error.message) {
            message = result.error.message
          } else {
            appStore.dispatch(appSlice.actions.addLog({log: true, msg: "Error setting visible to " + contact.did + " " + JSON.stringify(result)}))
          }
          setActionErrors(errors => R.concat(errors, [message]))
        })
      }
    })
    .then(() => {
      return utility.loadContacts(appSlice, appStore, dbConnection)
    })
    .catch(e => {
      hitError = true
      setActionErrors(errors => R.concat(errors, [e]))
    })

    setLoadingAction(R.set(R.lensProp(contact.did), false, loadingAction))
    return hitError
  }

  const singleAllowToSeeMe = async (contact: Contact) => {
    const hitError = await allowToSeeMe(contact)
    if (hitError) {
      setQuickMessage('Visibility Error!\nSee messages at the top.')
      setTimeout(() => { setQuickMessage(null) }, 2000)
    }
  }

  /**
    similar to allowToSeeMe & checkVisibility
   */
  const disallowToSeeMe = async (contact: Contact) => {
    let hitError = false
    setLoadingAction(R.set(R.lensProp(contact.did), true, loadingAction))

    const endorserApiServer = appStore.getState().settings.apiServer
    const token = await utility.accessToken(allIdentifiers[0])
    await fetch(endorserApiServer + '/api/report/cannotSeeMe', {
      method: 'POST',
      headers: {
        "Content-Type": "application/json",
        "Uport-Push-Token": token,
      },
      body: JSON.stringify({ did: contact.did })
    }).then(async response => {
      if (response.status === 200) {
        // contact.seesMe = ... silently fails
        const newContact = R.set(R.lensProp('seesMe'), false, contact)
        return saveContact(newContact)
      } else {
        hitError = true
        await response
        .json()
        .then(result => {
          let message = 'There was an error from the server trying to hide you from ' + contact.name + '. See log for more info.'
          if (result && result.error && result.error.message) {
            message = result.error.message
          } else {
            appStore.dispatch(appSlice.actions.addLog({log: true, msg: "Error hiding from " + contact.did + " " + JSON.stringify(result)}))
          }
          setActionErrors(errors => R.concat(errors, [message]))
        })
      }
    })
    .then(() => {
      return utility.loadContacts(appSlice, appStore, dbConnection)
    })
    .catch(e => {
      hitError = true
      setActionErrors(errors => R.concat(errors, [e]))
    })

    setLoadingAction(R.set(R.lensProp(contact.did), false, loadingAction))
    return hitError
  }

  const singleDisallowToSeeMe = async (contact: Contact) => {
    const hitError = await disallowToSeeMe(contact)
    if (hitError) {
      setQuickMessage('Hiding Error!\nSee messages at the top.')
      setTimeout(() => { setQuickMessage(null) }, 2000)
    }
  }

  /**
    Register them on the server

    Note that this could be called for one or as part of a bulk call.
   */
  const register = async (contact: Contact) => {
    let hitError = false
    setLoadingAction2(R.set(R.lensProp(contact.did), true, loadingAction2))

    const endorserApiServer = appStore.getState().settings.apiServer
    const token = await utility.accessToken(allIdentifiers[0])
    const signer = didJwt.SimpleSigner(allIdentifiers[0].keys[0].privateKeyHex)
    const claimRegister = {
      "@context": "https://schema.org",
      "@type": "RegisterAction",
      agent: { did: allIdentifiers[0].did },
      object: SERVICE_ID,
      participant: { did: contact.did },
    }
    const vcJwt: string = await didJwt.createJWT(utility.vcPayload(claimRegister), { issuer: allIdentifiers[0].did, signer })

    await fetch(endorserApiServer + '/api/claim', {
      method: 'POST',
      headers: {
        "Content-Type": "application/json",
        "Uport-Push-Token": token,
      },
      body: JSON.stringify({ jwtEncoded: vcJwt })
    }).then(async response => {
      if (response.status === 201) {
        if (!contact.registered) {
          const conn = await dbConnection
          conn.manager.update(Contact, contact.did, { registered: true })
          utility.loadContacts(appSlice, appStore, dbConnection)
        }
      } else {
        hitError = true
        await response
        .json()
        .then(result => {
          let message = 'There was an error from the server trying to register ' + contact.did
          if (result.error) {
            if (result.error.message) {
              message = result.error.message
            } else {
              appStore.dispatch(appSlice.actions.addLog({log: true, msg: "Error registering " + contact.did + " " + JSON.stringify(result)}))
            }
          } else {
            appStore.dispatch(appSlice.actions.addLog({log: true, msg: "Error registering " + contact.did + " " + JSON.stringify(result)}))
          }
          setActionErrors(errors => R.concat(errors, [message]))
        })
      }
    })
    .catch(e => {
      hitError = true
      setActionErrors(errors => R.concat(errors, [e]))
    })

    setLoadingAction2(R.set(R.lensProp(contact.did), false, loadingAction2))
    return hitError
  }

  const singleRegister = async (contact: Contact) => {
    const hitError = await register(contact)
    if (hitError) {
      setQuickMessage('Registration Error!\nSee messages at the top.')
      setTimeout(() => { setQuickMessage(null) }, 2000)
    }
  }

  const deleteContact = async (did) => {
    const conn = await dbConnection
    await conn.manager.delete(Contact, { 'did' : did })
    utility.loadContacts(appSlice, appStore, dbConnection)
  }

  const retrieveContactUrl = async () => {
    return utility.contactJwtForPayload(
      DEFAULT_ENDORSER_VIEW_SERVER,
      allIdentifiers[0],
      appStore.getState().settings.name
    )
  }

  const generateContactUrl = async () => {
    const url = await retrieveContactUrl()
    setMyContactUrl(url)
    setShowMyQr(!showMyQr)
  }

  useFocusEffect(
    React.useCallback(() => {
      utility.loadContacts(appSlice, appStore, dbConnection)
    }, [])
  )

  useFocusEffect(
    React.useCallback(() => {
    if (scannedImport) {
      if (scannedImport.indexOf(utility.ENDORSER_JWT_URL_LOCATION) > -1) {
        // contact info is embedded in the URL
        const contactPayload = utility.getContactPayloadFromJwtUrl(scannedImport)
        setContactDid(contactPayload.iss)
        setContactName(contactPayload.own && contactPayload.own.name)
        setContactPubKeyBase64(contactPayload.own && utility.checkPubKeyBase64(contactPayload.own.publicEncKey))
        setInputContactData(true)
      } else {
        // retrieve from the URL and try to extract
        fetch(scannedImport, { cache: "no-cache" })
        .then(result => {
          return result.text()
        })
        .then(text => {
          setContactsCsvText(text)
          setWantsCsvText(true)
        })
      }
      setScannedImport(null)
    }
    }, [scannedImport])
  )

  return (
    <SafeAreaView>
      <ScrollView>
        <View style={{ padding: 10 }}>
          <Text style={{ fontSize: 30, fontWeight: 'bold' }}>
            Contacts
            {
              (appStore.getState().settings.apiServer !== DEFAULT_ENDORSER_API_SERVER
               || appStore.getState().viewServer !== DEFAULT_ENDORSER_VIEW_SERVER)
               ? " - Custom Servers"
               : ""
            }
          </Text>

          <View style={{ backgroundColor: 'rgba(0,0,0,0.9)', height: 0.8, width: '100%', padding: 5 }}/>
          <Text>Import</Text>

          <Button
            title="Scan QR Code"
            onPress={() => navigation.navigate('Contact Import') }
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
            onPress={() => setWantsCsvText(true)}
          />

          <View style={{ padding: 5 }} />
          <Button
            title="Import Bulk from URL"
            onPress={() => setWantsCsvUrl(true)}
          />

          {csvMessages.length > 0 ? (
            <View style={{ marginBottom: 20 }}>
              <Text>{ csvMessages.join("\n") }</Text>
            </View>
          ) : (
            <View />
          )}

          {actionErrors.length > 0 ? (
            <View style={{ borderWidth: 1, marginTop: 20, padding: 10 }}>
              <Text style={{ textAlign: 'right' }} >
                <Icon name="close" onPress={() => setActionErrors([])} />
              </Text>
              <Text style={{ color: 'red' }}>Errors and Warnings:</Text>
              <Text style={{ padding: 5 }}>{ "- " + actionErrors.join("\n- ") }</Text>
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
                  <View>
                    <Text>Saving...</Text>
                    <ActivityIndicator color="#00ff00" />
                  </View>
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
                      title={ 'After saving, make your claims visible to all of them on the server.' }
                      checked={wantsToBeVisible}
                      onPress={() => {setWantsToBeVisible(!wantsToBeVisible)}}
                    />

                    <CheckBox
                      title={ 'Register them on the server.' }
                      checked={wantsToRegister}
                      onPress={() => {setWantsToRegister(!wantsToRegister)}}
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
                  <View>
                    <Text>Saving...</Text>
                    <ActivityIndicator color="#00ff00" />
                  </View>
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
                      title={ 'After saving, make your claims visible to all of them on the server.' }
                      checked={wantsToBeVisible}
                      onPress={() => {setWantsToBeVisible(!wantsToBeVisible)}}
                    />

                    <CheckBox
                      title={ 'Register them on the server.' }
                      checked={wantsToRegister}
                      onPress={() => {setWantsToRegister(!wantsToRegister)}}
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

                <CheckBox
                  title={ 'Make your claims visible to them on the server.' }
                  checked={wantsToBeVisible}
                  onPress={() => {setWantsToBeVisible(!wantsToBeVisible)}}
                />

                <CheckBox
                  title={ 'Register them on the server.' }
                  checked={wantsToRegister}
                  onPress={() => {setWantsToRegister(!wantsToRegister)}}
                />

                <TouchableHighlight
                  style={styles.saveButton}
                  onPress={() => singleCreateContactFromDataState() }
                >
                  <Text>Save</Text>
                </TouchableHighlight>

                <View style={{ padding: 5 }}/>
                <TouchableHighlight
                  style={styles.cancelButton}
                  onPress={() => setInputContactData(false) }
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

                <CheckBox
                  title={ 'Make your claims visible to them on the server.' }
                  checked={wantsToBeVisible}
                  onPress={() => {setWantsToBeVisible(!wantsToBeVisible)}}
                />

                <CheckBox
                  title={ 'Register them on the server.' }
                  checked={wantsToRegister}
                  onPress={() => {setWantsToRegister(!wantsToRegister)}}
                />

                <TouchableHighlight
                  style={styles.saveButton}
                  onPress={() => singleCreateContactFromUrlState() }
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
        {
          allIdentifiers.length > 0
          ?
            <View style={{ padding: 10 }}>
              {/*----------------------------------------------------------------*/}
              <View style={{ backgroundColor: 'rgba(0,0,0,0.9)', height: 0.8, width: '100%', padding: 5 }}/>
              <Text>Your Info</Text>

              <Text
                style={{ color: 'blue', ...styles.centeredText }}
                onPress={async () => copyToClipboard(await retrieveContactUrl())}
              >
                Copy Your URL to the Clipboard
              </Text>

              <View style={{ padding: 10 }} />
              <Text
                style={{ color: 'blue', ...styles.centeredText }}
                onPress={() => generateContactUrl()}
              >
                { (showMyQr ? "Hide" : "Show") + " Your URL in a QR Code" }
              </Text>
              {
                showMyQr
                ?
                  <View style={{ marginBottom: 10, ...styles.centeredView}}>
                    <QRCode
                      value={myContactUrl}
                      size={300}
                    />
                  </View>
                :
                  <View/>
              }

            </View>
          :
            <View/>
        }
        <View style={{ padding: 10 }}>
          { allContacts && allContacts.length > 0
            ? <View>
                {/*----------------------------------------------------------------*/}
                <View style={{ backgroundColor: 'rgba(0,0,0,0.9)', height: 0.8, width: '100%', padding: 5 }}/>
                <Text>All Contacts</Text>
                <View style={{ padding: 10 }}>
                  <Button title="Export All to Clipboard (CSV)" onPress={copyContactsToClipboard} />
                </View>
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
                  loadingAction[contact.did] || loadingAction2[contact.did]
                  ?
                    <ActivityIndicator color="#00ff00" />
                  :
                    <View style={styles.centeredView}>
                    {
                      allIdentifiers[0] == null
                      ?
                        <View/>
                      :
                        (contact.did === allIdentifiers[0].did)
                        ?
                          <View><Text>You can always see your own activity on the Endorser server.</Text></View>
                        :
                          R.isNil(contact.seesMe)
                          ?
                            <View>
                              <Button style={{ textAlign: 'center' }}
                                title={`Can ${contact.name || 'They'} See Your Activity?`}
                                onPress={() => {singleCheckVisibility(contact)}}
                              />
                              <View style={{ marginTop: 5 }}/>
                             <Button
                               title="Make Yourself Visible"
                               onPress={() => {singleAllowToSeeMe(contact)}}
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
                                 title="Hide Yourself"
                                 onPress={() => {singleDisallowToSeeMe(contact)}}
                               />
                               : <Button
                                 title="Make Yourself Visible"
                                 onPress={() => {singleAllowToSeeMe(contact)}}
                               />
                             }
                             <View style={{ marginTop: 5 }}/>
                             <Button
                               title={`(Double-Check Visibility)`}
                               onPress={() => {singleCheckVisibility(contact)}}
                             />
                           </View>
                    }
                    {
                      allIdentifiers[0] == null
                      ?
                        <View/>
                      :
                        <View style={{ marginTop: 5 }}>
                          <Text>
                            { contact.did === allIdentifiers[0].did ? 'You' : contact.name }
                            &nbsp;
                            { contact.registered ? (allIdentifiers[0] && contact.did === allIdentifiers[0].did ? 'are' : 'is') : 'might not be' } registered on the server.
                          </Text>
                          {
                            !contact.registered
                            ?
                              <Button
                                title={`Register`}
                                onPress={() => { singleRegister(contact) }}
                              />
                            :
                              <View />
                          }
                        </View>
                    }
                    </View>
                }
                <View style={styles.centeredView}>
                  <Button title={'Delete'} onPress={() => setConfirmDeleteContact(contact.did)}/>
                </View>
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
                    setTimeout(() => { setQuickMessage(null) }, 1000)
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
