import React, { useEffect, useState } from 'react'
import { Button, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native'
import QRCodeScanner from 'react-native-qrcode-scanner'

import { dbConnection } from '../veramo/setup.ts'
import { Contact } from '../entity/contact'

export function ContactsScreen({ navigation }) {

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

  useEffect(() => {
    const getContacts = async () => {
      const conn = await dbConnection
      const allContacts = await conn.manager.find(Contact)
      setContacts(allContacts)
    }
    getContacts()
  }, [])

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

export function ContactImportScreen() {

  const [contactInfo, setContactInfo] = useState<string>()
  const [saved, setSaved] = useState<boolean>(false)

  const createContact = async () => {
    const contact = new Contact();
    contact.did = contactInfo.iss

    const conn = await dbConnection
    let newContact = await conn.manager.save(contact)
    setSaved(true)
  }

  const onSuccess = (e) => {
    console.log('scanned data' + e.data);
    const check = e.data.substring(0, 4);
    console.log('scanned data prefix' + check);
  }

  return (
    <SafeAreaView>
      <ScrollView>
        <View style={{ padding: 20 }}>
          <Text style={{ fontSize: 30, fontWeight: 'bold' }}>Import Contact</Text>
          <QRCodeScanner
            onBarCodeRead={onSuccess}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
