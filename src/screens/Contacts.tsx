import { classToPlain } from 'class-transformer'
import * as R from 'ramda'
import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Button, FlatList, Modal, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableHighlight, View } from 'react-native'
import Clipboard from '@react-native-community/clipboard';
import { useFocusEffect } from '@react-navigation/native';
import QRCodeScanner from 'react-native-qrcode-scanner'
import { useSelector } from 'react-redux'

import { Contact } from '../entity/contact'
import * as utility from '../utility/utility'
import { appSlice, appStore } from '../veramo/appSlice'
import { agent, dbConnection } from '../veramo/setup'

export function ContactsScreen({ navigation, route }) {

  const [contactDid, setContactDid] = useState<string>()
  const [contactName, setContactName] = useState<string>()
  const [identifiers, setIdentifiers] = useState<Identifier[]>([])
  const [loadingAction, setLoadingAction] = useState<Record<string,boolean>>({})

  const allContacts = useSelector((state) => state.contacts || [])

  const setContactInState = async (contact) => {
    const newContactEntity = new Contact()
    {
      // fill in with contact info
      const keys = Object.keys(contact)
      for (key of keys) {
        newContactEntity[key] = contact[key]
      }
    }
    const conn = await dbConnection
    await conn.manager.save(newContactEntity)

    appStore.dispatch(appSlice.actions.setContact(classToPlain(contact)))
  }

  const allContactText = () => (
    allContacts.map((contact) => (
      `
      ${contact.name}
      ${contact.did}
      `
    )).join('\n\n')
  )

  const copyToClipboard = () => {
    Clipboard.setString(allContactText())
  }

  const createContact = async () => {
    const contact = new Contact()
    contact.did = contactDid
    contact.name = contactName
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
      return response.json()
      if (response.status !== 200) {
        throw Error('There was an error from the server trying to set you as visible.')
      }
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

  const deleteContact = async () => {
    if (allContacts.length > 0) {
      const last = allContacts[allContacts.length - 1]
      const conn = await dbConnection
      await conn.manager.delete(Contact, { 'did' : last.did })
      utility.loadContacts(appSlice, appStore, dbConnection)
    }
  }

  useFocusEffect(
    React.useCallback(() => {

      agent.didManagerFind().then(ids => setIdentifiers(ids))

      utility.loadContacts(appSlice, appStore, dbConnection)

    }, [appStore.getState().contacts])
  )

  return (
    <SafeAreaView>
        <View style={{ padding: 20 }}>
          <Text style={{ fontSize: 30, fontWeight: 'bold' }}>Contacts</Text>
          <View style={styles.centeredView}>
            <Button
              title="Scan & Import"
              onPress={() => navigation.navigate('ContactImport')}
            />
          <Text>Or</Text>
          </View>
          <View style={{ padding: 10 }}>
            <Text>Name</Text>
            <TextInput
              value={contactName}
              onChangeText={setContactName}
              editable
              style={{ borderWidth: 1 }}
            />
            <Text>DID</Text>
            <TextInput
              value={contactDid}
              onChangeText={setContactDid}
              editable
              style={{ borderWidth: 1 }}
              autoCapitalize='none'
              autoCorrect={false}
            />
            <Button
              title='Create'
              onPress={createContact}
            />
          </View>
        </View>
        <View style={{ padding: 20 }}>
          <FlatList
            style={{ borderWidth: allContacts.length === 0 ? 0 : 1 }}
            data={allContacts}
            keyExtractor={contact => contact.did}
            renderItem={data =>
              <View style={{ padding: 20 }}>
                <Text style={{ fontSize: 11 }}>
                  {data.item.name + '\n' + data.item.did}
                </Text>
                {
                  loadingAction[data.item.did]
                  ? <ActivityIndicator size={'large'} />
                  : <View style={styles.centeredView}>
                    {
                      R.isNil(data.item.seesMe)
                      ? <View>
                        <Button style={{ textAlign: 'center' }}
                          title={`Can ${data.item.name} See Me?`}
                          onPress={() => {checkVisibility(data.item)}}
                        />
                        <Button
                          title="Make Me Visible"
                          onPress={() => {allowToSeeMe(data.item)}}
                        />
                      </View>
                      : <View>
                        <Text style={{ textAlign: 'center' }}>{
                          `${data.item.name} can${data.item.seesMe ?'' : 'not'} see you.`
                        }</Text>
                        {
                          data.item.seesMe
                          ? <Button
                            title="(Hide Me)"
                            onPress={() => {disallowToSeeMe(data.item)}}
                          />
                          : <Button
                            title="(Unhide Me)"
                            onPress={() => {allowToSeeMe(data.item)}}
                          />
                        }
                        <Button
                          title={`(Double-Check Visibility)`}
                          onPress={() => {checkVisibility(data.item)}}
                        />
                      </View>
                    }
                  </View>
                }
              </View>
            }
            ItemSeparatorComponent={() => <View style={styles.line}/>}
          />
          { allContacts.length > 0 ? (
            <View>
              <Button
                title="Copy to Clipboard"
                onPress={copyToClipboard}
              />
              {/** good for tests, bad for users
              <View style={{ marginTop: 200 }}>
                <Button
                  title="Delete Last Contact"
                  onPress={deleteContact}
                />
              </View>
              **/}
            </View>
          ) : (
            <Text></Text>
          )}
        </View>
    </SafeAreaView>
  )
}

export function ContactImportScreen({ navigation }) {

  const [contactInfo, setContactInfo] = useState<any>()
  const [saved, setSaved] = useState<boolean>(false)

  const onSuccessfulQR = async (e) => {
    const data = JSON.parse(e.data)
    setContactInfo(data)
  }

  const onAccept = () => {
    const saveAndRedirect = async() => {

      const conn = await dbConnection
      const contact = new Contact()
      contact.did = contactInfo.iss
      contact.name = contactInfo.own && contactInfo.own.name
      const newContact = await conn.manager.save(contact)
      setSaved(true)
      appStore.dispatch(appSlice.actions.setContacts([]))

      setTimeout(() => { navigation.navigate('Contacts')}, 500)
    }
    saveAndRedirect()
  }

  return (
    <SafeAreaView>
      <ScrollView>
        <View style={{ padding: 20 }}>
          <Text style={{ fontSize: 30, fontWeight: 'bold' }}>Import Contact</Text>

          <Modal
            animationType="slide"
            transparent={true}
            visible={!!contactInfo}
            onRequestClose={() => {
              Alert.alert("Modal has been closed.");
            }}
          >
            <View style={styles.centeredView}>
              <View style={styles.modalView}>
                { saved ? (
                  <Text style={styles.modalText}>Success!</Text>
                ) : (
                  <View>
                    <Text style={styles.modalText}>Save this contact?</Text>

                    <TouchableHighlight
                      style={styles.cancelButton}
                      onPress={() => {
                        setContactInfo(null)
                      }}
                    >
                      <Text>Cancel</Text>
                    </TouchableHighlight>
                    <TouchableHighlight
                      style={styles.saveButton}
                      onPress={onAccept}
                    >
                      <Text>Save</Text>
                    </TouchableHighlight>
                  </View>
                )}
              </View>
            </View>
          </Modal>

          { contactInfo ? (
              <View>
                <Text>Name: {(contactInfo.own && contactInfo.own.name) || ''}</Text>
                {/** fontSize 11 fits on an iPhone without wrapping **/}
                <Text style={{ fontSize: 11 }}>{contactInfo.iss || ''}</Text>
              </View>
            ) : (
              <View>
                <QRCodeScanner onBarCodeRead={onSuccessfulQR} />
                {/** good for tests, bad for users
                <Button
                  title='Fake It'
                  onPress={() => onSuccessfulQR({data:JSON.stringify({
                    iss:"did:ethr:0x5d2c57851928f0981edcdf65e75e5e73d899cdbs",
                    own: {
                        "name": "Trent",
                        "publicEncKey": "Ua+sRNwveB4+X1g4bzOVPBofXf8hQMZs5xD5oXuZ9CA="
                      }
                    }
                  )})}
                />
                **/}
              </View>
            )
          }
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
  modalView: {
    margin: 20,
    backgroundColor: "white",
    borderRadius: 20,
    padding: 35,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5
  },
  cancelButton: {
    backgroundColor: "#F194FF",
    borderRadius: 20,
    padding: 10,
    elevation: 2
  },
  saveButton: {
    backgroundColor: "#00FF00",
    borderRadius: 20,
    padding: 10,
    elevation: 2
  },
  textStyle: {
    color: "white",
    fontWeight: "bold",
    textAlign: "center"
  },
  modalText: {
    marginBottom: 15,
    textAlign: "center"
  },
  line: {
    height: 0.8,
    width: "100%",
    backgroundColor: "rgba(0,0,0,0.9)"
  },
})
