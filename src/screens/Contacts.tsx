import { classToPlain } from 'class-transformer'
import React, { useEffect, useState } from 'react'
import { Button, Modal, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableHighlight, View } from 'react-native'
import Clipboard from '@react-native-community/clipboard';
import { useFocusEffect } from '@react-navigation/native';
import QRCodeScanner from 'react-native-qrcode-scanner'
import { useSelector } from 'react-redux'

import { dbConnection } from '../veramo/setup.ts'
import { appSlice, appStore } from '../veramo/appSlice.ts'
import { Contact } from '../entity/contact'

export function ContactsScreen({ navigation, route }) {

  const [contactDid, setContactDid] = useState<string>()
  const [contactName, setContactName] = useState<string>()

  const allContacts = useSelector((state) => state.contacts)

  const loadContacts = async () => {
    const conn = await dbConnection
    const foundContacts = await conn.manager.find(Contact)
    appStore.dispatch(appSlice.actions.setIdentifiers(classToPlain(foundContacts)))
  }

  const allContactText = () => (
    allContacts?.map((contact) => (
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

    const conn = await dbConnection
    let newContact = await conn.manager.save(contact)
    loadContacts()
  }

  useFocusEffect(
    React.useCallback(() => {
      if (appStore.getState().contacts && appStore.getState().contacts.length === 0) {
        loadContacts()
      }
    }, [appStore.getState().contacts])
  )

  return (
    <SafeAreaView>
      <ScrollView>
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
          <TextInput
            multiline={true}
            editable={false}
            style={{ borderWidth: (allContacts.length === 0 ? 0 : 1), fontSize: 12 }}
          >
            { allContactText() }
          </TextInput>
          { allContacts.length > 0 ? (
            <Button
              title="Copy to Clipboard"
              onPress={copyToClipboard}
            />
          ) : (
            <Text></Text>
          )}
        </View>
      </ScrollView>
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
      appStore.dispatch(appSlice.actions.setIdentifiers([]))

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
                {/** fontSize 12 fits on an iPhone without wrapping **/}
                <Text>Name: {(contactInfo.own && contactInfo.own.name) || ''}</Text>
                <Text style={{ fontSize: 12 }}>{contactInfo.iss || ''}</Text>
              </View>
            ) : (
              <View>
                <QRCodeScanner onBarCodeRead={onSuccessfulQR} />
                {/**
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
  }
})
