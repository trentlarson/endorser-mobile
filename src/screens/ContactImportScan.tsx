import * as didJwt from 'did-jwt'
import React, { useState } from 'react'
import { ActivityIndicator, Alert, Button, Modal, SafeAreaView, ScrollView, StyleSheet, Text, TouchableHighlight, View } from 'react-native'
import { CheckBox } from 'react-native-elements'
import QRCodeScanner from 'react-native-qrcode-scanner'
import { useFocusEffect } from '@react-navigation/native'

import { Contact } from '../entity/contact'
import { appSlice, appStore } from '../veramo/appSlice'
import { agent, dbConnection } from '../veramo/setup'
import * as utility from '../utility/utility'

export function ContactImportScreen({ navigation }) {

  const CURRENT_JWT_PREFIX = appStore.getState().viewServer + utility.ENDORSER_JWT_URL_LOCATION

  const [contactInfo, setContactInfo] = useState<Contact>()
  const [identifiers, setIdentifiers] = useState<Identifier[]>([])
  const [wantsToBeVisible, setWantsToBeVisible] = useState<boolean>(true)

  // these are tracking progress when saving data
  const [saving, setSaving] = useState<boolean>(false)
  const [storingVisibility, setStoringVisibility] = useState<boolean>(false)
  const [doneSavingStoring, setDoneSavingStoring] = useState<boolean>(false)
  const [visibilityError, setVisibilityError] = useState<string>('')

  const onSuccessfulQrEvent = async (e) => {
    onSuccessfulQrText(e.data)
  }

  const onSuccessfulQrText = async (jwtText) => {
    const endorserContextLoc = jwtText.indexOf(utility.ENDORSER_JWT_URL_LOCATION)
    if (endorserContextLoc > -1) {
      jwtText = jwtText.substring(endorserContextLoc + utility.ENDORSER_JWT_URL_LOCATION.length)
    }
    if (jwtText.startsWith(utility.UPORT_JWT_PREFIX)) {
      jwtText = jwtText.substring(prefix.length)
    }

    // JWT format: { header, payload, signature, data }
    const jwt = didJwt.decodeJWT(jwtText)

    const payload = jwt.payload
    setContactInfo(payload)
  }

  const clearModalAndRedirect = () => {
    setContactInfo(null)
    navigation.navigate('Contacts')
  }


  const allowToSeeMe = async (contact) => {
    const endorserApiServer = appStore.getState().apiServer
    const token = await utility.accessToken(identifiers[0])
    await fetch(endorserApiServer + '/api/report/canSeeMe', {
      method: 'POST',
      headers: {
        "Content-Type": "application/json",
        "Uport-Push-Token": token,
      },
      body: JSON.stringify({ did: contact.did })
    }).then(response => {
      if (response.status !== 200) {
        throw ('There was an error from the server trying to set you as visible. ' + new Date().getMilliseconds())
      }
    })
  }

  const onAccept = () => {
    const saveAndRedirect = async() => {
      setSaving(true)
      const conn = await dbConnection
      const contact = new Contact()
      contact.did = contactInfo.iss
      contact.name = contactInfo.own && contactInfo.own.name
      contact.pubKeyBase64 = contactInfo.own && contactInfo.own.publicEncKey
      const newContact = await conn.manager.save(contact)
      setSaving(false)
      appStore.dispatch(appSlice.actions.setContacts(null)) // force reload

      if (wantsToBeVisible) {
        setStoringVisibility(true)
        await allowToSeeMe(contact, identifiers[0])
        .then(() => {
          setTimeout(clearModalAndRedirect, 500)
        })
        .catch(err => {
          setVisibilityError(contact.name + ' was saved.  However, there was a problem with setting visibility.  Mark yourselv visible or not on the Contacts page.')
        })
        .finally(() => {
          setStoringVisibility(false)
          setDoneSavingStoring(true)
        })
      } else {
        setDoneSavingStoring(true)
        setTimeout(clearModalAndRedirect, 500)
      }
    }

    saveAndRedirect()
  }

  useFocusEffect(
    React.useCallback(() => {
      agent.didManagerFind().then(ids => setIdentifiers(ids))
    }, [])
  )

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
                { saving ? (
                  <ActivityIndicator color="#00ff00" />
                ) : (
                  <View>
                    { storingVisibility ? (
                      <View>
                        <Text style={styles.modalText}>Storing visibility...</Text>
                        <ActivityIndicator color="#00ff00" />
                      </View>
                    ) : (

                      doneSavingStoring ? (
                        visibilityError ? (
                          <View>
                            <Text style={styles.modalText}>{ visibilityError }</Text>
                            <TouchableHighlight
                              style={styles.cancelButton}
                              onPress={ clearModalAndRedirect }
                            >
                              <Text>OK</Text>
                            </TouchableHighlight>
                          </View>
                        ) : (
                          <Text style={styles.modalText}>Saved.</Text>
                        )
                      ) : (

                        <View>
                          <Text style={styles.modalText}>Save this contact?</Text>

                          <CheckBox
                            title={ 'Make my claims visible to ' + contactInfo?.own?.name }
                            checked={wantsToBeVisible}
                            onPress={() => {setWantsToBeVisible(!wantsToBeVisible)}}
                          />

                          <TouchableHighlight
                            style={styles.cancelButton}
                            onPress={() => {
                              setContactInfo(null)
                            }}
                          >
                            <Text>Cancel</Text>
                          </TouchableHighlight>
                          <View style={{ padding: 5 }}/>
                          <TouchableHighlight
                            style={styles.saveButton}
                            onPress={onAccept}
                          >
                            <Text>Save</Text>
                          </TouchableHighlight>
                        </View>
                      )
                    )}
                  </View>
                )}
              </View>
            </View>
          </Modal>

          { contactInfo ? (
              <View>
                <Text>Name: {(contactInfo.own && contactInfo.own.name) || ''}</Text>
                <Text style={{ fontSize: 11 }}>Key: {(contactInfo.own && contactInfo.own.publicEncKey) || ''}</Text>
                {/** fontSize 11 fits on an iPhone without wrapping **/}
                <Text style={{ fontSize: 11 }}>{contactInfo.iss || ''}</Text>
              </View>
            ) : (
              <View>
                <QRCodeScanner onRead={onSuccessfulQrEvent} />
                { appStore.getState().testMode
                  ? <Button
                      title='Fake It'
                      onPress={() => onSuccessfulQrText(CURRENT_JWT_PREFIX + "eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NksifQ.eyJpYXQiOjE2MTUyNjMwODc3OTMsImlzcyI6ImRpZDpldGhyOjB4M2YyMDVFMTgwOGU4NWVDREFmYTU0MGYyZEE1N0JkQzhkOWQyZDUxRCIsIm93biI6eyJuYW1lIjoiU3R1ZmYiLCJwdWJsaWNFbmNLZXkiOiJnM1oxbUpzSDlzRVVXM1ZremtXb2tZenlKRUdGUUFidG9QcnFqT0s3RWs0PSJ9fQ.h27enm55_0Bd06UJHAQWRmULwidOOhHNe2reqjYTAcVJvQ0aUTCEmP88HlJcZ3bUa-VbrXT76sqV6i19bQZ_PA")}
                    />
                  : <View/>
                }
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
