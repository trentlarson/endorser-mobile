import React, { useEffect, useState } from 'react'
import { Button, Modal, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableHighlight, View } from 'react-native'
import { useFocusEffect } from '@react-navigation/native';
import QRCodeScanner from 'react-native-qrcode-scanner'

import { dbConnection } from '../veramo/setup.ts'
import { Contact } from '../entity/contact'

export function ContactsScreen({ navigation, route }) {

  const [contactDid, setContactDid] = useState<string>()
  const [contactName, setContactName] = useState<string>()
  const [contacts, setContacts] = useState<Array<Contact>>([])

  const createContact = async () => {
    const contact = new Contact();
    contact.did = contactDid
    contact.name = contactName

    const conn = await dbConnection
    let newContact = await conn.manager.save(contact)
    setContacts((cs) => cs.concat(newContact))
  }

  const newContact = route && route.params && route.params.newContact
  useFocusEffect(
    React.useCallback(() => {
      const getContacts = async () => {
        const conn = await dbConnection
        const allContacts = await conn.manager.find(Contact)
        setContacts(allContacts)
      }
      getContacts()
    }, [newContact])
  )

  return (
    <SafeAreaView>
      <ScrollView>
        <Button
          title="Import"
          onPress={() => navigation.navigate('ContactImport')}
        />
        <View style={{ padding: 20 }}>
          <Text style={{ fontSize: 30, fontWeight: 'bold' }}>Contacts</Text>
          <Text>DID</Text>
          <TextInput
            value={contactDid}
            onChangeText={setContactDid}
            editable
            style={{ borderWidth: 1 }}
            autoCapitalize='none'
            autoCorrect={false}
          />
          <Text>Name</Text>
          <TextInput
            value={contactName}
            onChangeText={setContactName}
            editable
            style={{ borderWidth: 1 }}
          />
          <Button
            title='Create'
            onPress={createContact}
          />
        </View>
        <View>
          { contacts.map((contact) => (
            <View key={contact.did} style={{ marginTop: 20 }}>
              <Text>{contact.did}</Text>
              <Text>{contact.name}</Text>
            </View>
          ))}
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

      setTimeout(() => { navigation.navigate('Contacts', { newContact: true })}, 500)
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

          {/**
            <QRCodeScanner onBarCodeRead={onSuccessfulQR} />          
          **/}
          { contactInfo ? (
              <View>
                {/** 13 font fits on an iPhone without wrapping **/}
                <Text style={{ fontSize: 13 }}>{contactInfo.iss || ''}</Text>
                <Text>Name: {(contactInfo.own && contactInfo.own.name) || ''}</Text>
              </View>
            ) : (
              <Button
                title='Create'
                onPress={() => onSuccessfulQR({data:JSON.stringify({
                  iss:"did:ethr:0x5d2c57851928f0981edcdf65e75e5e73d899cdbm",
                  own: {
                      "name": "Trent",
                      "publicEncKey": "Ua+sRNwveB4+X1g4bzOVPBofXf8hQMZs5xD5oXuZ9CA="
                    }
                  }
                )})}
              />
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
