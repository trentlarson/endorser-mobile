import crypto from 'crypto'
import Debug from 'debug'
import * as didJwt from 'did-jwt'
import { DateTime, Duration } from 'luxon'
import * as R from 'ramda'
import React, { useEffect, useState } from 'react'
import { Alert, Button, FlatList, Modal, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableHighlight, TouchableOpacity, View } from 'react-native'
import { CheckBox } from "react-native-elements"
import { useSelector } from 'react-redux'

import { ContactSelectModal } from './ContactSelect'
import { styles } from './style'
import { MASTER_COLUMN_VALUE, Settings } from '../entity/settings'
import * as utility from '../utility/utility'
import { BVCButton } from '../utility/utility.tsx'
import { appSlice, appStore } from '../veramo/appSlice'
import { agent, dbConnection } from '../veramo/setup'

const debug = Debug('endorser-mobile:share-credential')

export function ConstructCredentialScreen({ navigation }) {

  const [askForCreditInfo, setAskForCreditInfo] = useState<boolean>(false)
  const [askForGiveInfo, setAskForGiveInfo] = useState<boolean>(false)
  const [askForPledgeInfo, setAskForPledgeInfo] = useState<string>('')
  const [askForWitnessInfo, setAskForWitnessInfo] = useState<string>('')
  const [hasMnemonic, setHasMnemonic] = useState<boolean>(false)

  const identifiers = useSelector((state) => state.identifiers)
  const settings = useSelector((state) => state.settings)

  let currentOrPreviousSat = DateTime.local()
  let todayIsSaturday = true
  if (currentOrPreviousSat.weekday !== 6) {
    // it's not Saturday, so let's default to last Saturday
    currentOrPreviousSat = currentOrPreviousSat.minus({week:1})
    todayIsSaturday = false
  }
  const eventStartDateObj = currentOrPreviousSat.set({weekday:6}).set({hour:9}).startOf("hour")
  // Hack, but the full ISO pushes the length to 340 which crashes verifyJWT!  Crazy!
  const TODAY_OR_PREV_START_DATE = eventStartDateObj.toISO({suppressMilliseconds:true})

  // Check for existing identifers on load and set them to state
  useEffect(() => {
    const getSettings = async () => {
      if (settings?.mnemEncrBase64 || settings?.mnemonic) {
        setHasMnemonic(true)
      }
    }
    getSettings()
  }, [])

  return (
    <SafeAreaView>
      <ScrollView>
        <View style={{ padding: 20 }}>
          { identifiers[0] ? (
            <View>
              <Text style={{ fontSize: 30, fontWeight: 'bold' }}>Create</Text>
              { !hasMnemonic ? (
                <Text style={{ padding: 10, color: 'red' }}>There is no backup available for this ID. We recommend you generate a different identifier and do not keep using this one. (See Help.)</Text>
              ) : (
                 <Text/>
              )}
              <View style={{ padding: 10 }}>
                {
                  askForGiveInfo
                  ? <GiveModal
                      sponsorId={ identifiers[0].did }
                      cancel={ () => setAskForGiveInfo(false) }
                      proceed={ claim => {
                        setAskForGiveInfo(false)
                        navigation.navigate('Sign Credential', { credentialSubject: claim })
                      }}
                    />
                  : <View/>
                }
                {
                  askForCreditInfo
                  ? <CreditModal
                      providerId={ identifiers[0].did }
                      cancel={ () => setAskForCreditInfo(false) }
                      proceed={ claim => {
                        setAskForCreditInfo(false)
                        navigation.navigate('Sign Credential', { credentialSubject: claim })
                      }}
                    />
                  : <View/>
                }
                {
                  askForPledgeInfo
                  ? <PledgeModal
                      agent={ identifiers[0].did }
                      pledge={ askForPledgeInfo }
                      cancel={ () => setAskForPledgeInfo('') }
                      proceed={ claim => {
                        setAskForPledgeInfo('')
                        navigation.navigate('Sign Credential', { credentialSubject: claim })
                      }}
                    />
                  : <View/>
                }
                {
                  askForWitnessInfo
                  ? <WitnessModal
                      text={ askForWitnessInfo }
                      cancel={ () => setAskForWitnessInfo('') }
                      proceed={ claim => {
                        setAskForWitnessInfo('')
                        navigation.navigate('Sign Credential', { credentialSubject: claim })
                      }}
                    />
                  : <View/>
                }
                <View>
                  <Text>What do you want to assert?</Text>
                  <View style={{ padding: 5 }} />
                  <BVCButton
                    description='BVC Meeting'
                    identifier={ identifiers[0] }
                    navigation={ navigation }
                  />
                  <View style={{ padding: 5 }} />
                  <Button
                    title={'Offer Credit'}
                    onPress={() => setAskForCreditInfo(true)}
                  />
                  <View style={{ padding: 5 }} />
                  <Button
                    title={'Offer Time'}
                    onPress={() => setAskForGiveInfo(true)}
                  />
                  <View style={{ padding: 5 }} />
                  <Button
                    title={'Witness To Something Great'}
                    onPress={() => setAskForWitnessInfo("They ")}
                  />
                  <View style={{ padding: 5 }} />
                  <Button
                    title={'Pledge To Thick Red Line'}
                    onPress={() => setAskForPledgeInfo("I recognize natural law, basic morality, and the Non-Aggression Principle, and I understand that it is morally and logically impossible for the government and/or my badge to confer rights upon me that the population does not have and cannot delegate.\nI pledge only to act to protect lives, liberty, and property.  I renounce the use of force or coercion on peaceful people where there is no victim to defend or protect.")}
                  />
                  <View style={{ padding: 5 }} />
                  <Button
                    title={'Pledge Honesty As An Officer'}
                    onPress={() => setAskForPledgeInfo("I commit to tell only the truth when identifying as a government representative.")}
                  />
                  <View style={{ padding: 5 }} />
                  <Button
                    title={'Pledge Liberty'}
                    onPress={() => setAskForPledgeInfo("We are as gods. I dedicate myself to reach my full potential. I will never ask another person to live for my sake.")}
                  />
                  <View style={{ padding: 5 }} />
                  <Button
                    title={'Pledge A Life Of Gifts'}
                    onPress={() => setAskForPledgeInfo("I help to create a world based on giving, in ways that fulfill me.")}
                  />
                </View>
              </View>
            </View>
          ) : (
            <Text>You must create an identifier (under Settings).</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )

  /**
    props has:
    - providerId string for the identifier of the provider
    - proceed function that takes the claim
    - cancel function
   **/
  function CreditModal(props) {

    const [amountStr, setAmountStr] = useState<string>('0')
    const [currency, setCurrency] = useState<string>('?')
    const [description, setDescription] = useState<string>('')
    const [expiration, setExpiration] = useState<string>(DateTime.local().plus(Duration.fromISO("P6M")).toISODate())
    const [recipientId, setRecipientId] = useState<string>('')
    const [termsOfService, setTermsOfService] = useState<string>("Acknowledge receipt of contract and funds (eg. with TakeAction).\nRecipient logs final payment (eg. with GiveAction) and provider agrees (eg. with AgreeAction).")
    const [transferAllowed, setTransferAllowed] = useState<boolean>(true)
    const [multipleTransfersAllowed, setMultipleTransfersAllowed] = useState<boolean>(false)

    function grantClaim(txnId: string, providerId: string, recipientId: string, amount: number, currency: string, description: string, termsOfService: string, transfersAllowed: number) {
      return {
        "@context": "https://schema.org",
        "@type": "LoanOrCredit",
        "amount": amount,
        "currency": currency,
        // recommend adding non-standard properties as key:value pairs in descriptions until they evolve into standard properties
        "description": description,
        "recipient": {
          "identifier": recipientId,
        },
        "provider": {
          "identifier": providerId
        },
        "numberOfTransfersAllowed": transfersAllowed,
        "termsOfService": termsOfService,
        "identifier": txnId,
      }
    }

    function grantClaimFromInputs() {
      return grantClaim(
        crypto.randomBytes(16).toString('hex'), // 128 bits seems OK
        props.providerId,
        recipientId,
        Number.parseFloat(amountStr),
        currency,
        description,
        termsOfService,
        multipleTransfersAllowed ? Number.MAX_SAFE_INTEGER : transferAllowed ? 1 : 0
      )
    }

    return (
      <Modal
        animationType="slide"
        transparent={true}
        onRequestClose={props.cancel}
      >
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <View>
              <Text style={styles.modalText}>Grant or Loan Money</Text>

              <View style={{ padding: 5 }}>
                <Text>Recipient</Text>
                <TextInput
                  value={recipientId}
                  onChangeText={setRecipientId}
                  editable
                  style={{ borderWidth: 1 }}
                  autoCapitalize={'none'}
                  autoCorrect={false}
                />
              </View>

              <View style={{ padding: 5 }}>
                <Text>Amount</Text>
                <TextInput
                  value={amountStr}
                  onChangeText={setAmountStr}
                  editable
                  length={ 5 }
                  style={{ borderWidth: 1 }}
                />
              </View>

              <View style={{ padding: 5 }}>
                <Text>Currency</Text>
                <TextInput
                  value={currency}
                  onChangeText={setCurrency}
                  editable
                  style={{ borderWidth: 1 }}
                />
              </View>

              <View style={{ padding: 5 }}>
                <Text>Description</Text>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  editable
                  multiline={true}
                  style={{ borderWidth: 1 }}
                />
              </View>

              <View style={{ padding: 5 }}>
                <Text>Terms</Text>
                <TextInput
                  value={termsOfService}
                  onChangeText={setTermsOfService}
                  editable
                  multiline={true}
                  style={{ borderWidth: 1 }}
                />
              </View>

              <View style={{ padding: 5 }}>
                <CheckBox
                  title='Transfer Allowed'
                  checked={transferAllowed}
                  onPress={() => {setTransferAllowed(!transferAllowed)}}
                />
                <View style={{ padding: 5, display: (transferAllowed ? 'flex' : 'none') }}>
                  <CheckBox
                    title='Multiple Transfers Allowed?'
                    checked={multipleTransfersAllowed}
                    onPress={() => {setMultipleTransfersAllowed(!multipleTransfersAllowed)}}
                    visible={transferAllowed}
                  />
                </View>
              </View>

              <View style={{ padding: 10 }} />
              <TouchableHighlight
                style={styles.saveButton}
                onPress={() => props.proceed(grantClaimFromInputs())}
              >
                <Text>Set...</Text>
              </TouchableHighlight>
              <View style={{ padding: 5 }} />
              <TouchableHighlight
                style={styles.cancelButton}
                onPress={props.cancel}
              >
                <Text>Cancel</Text>
              </TouchableHighlight>
            </View>
          </View>
        </View>
      </Modal>
    )
  }

  /**
    props has:
    - funderId string for the identifier of the sponsor
    - proceed function that takes the claim
    - cancel function
   **/
  function GiveModal(props) {

    const [comment, setComment] = useState<string>('')
    const [durationInHours, setDurationInHours] = useState<string>('1')
    const [expiration, setExpiration] = useState<string>(DateTime.local().plus(Duration.fromISO("P6M")).toISODate())
    const [fundedId, setFundedId] = useState<string>('')
    const [termsOfService, setTermsOfService] = useState<string>("Let's talk beforehand about reasonable terms such as location, advance notice, amount of exertion, etc.\nRecipient records delivery with TakeAction.")
    const [transferAllowed, setTransferAllowed] = useState<boolean>(true)
    const [multipleTransfersAllowed, setMultipleTransfersAllowed] = useState<boolean>(false)

    function grantClaim(grantId: string, funderId: string, fundedId: string, comments: string, durationInHours: string, expiration: string, termsOfService: string, transfersAllowed: number) {
      return {
        "@context": "https://schema.org",
        "@type": "GiveAction",
        // recommend adding non-standard properties as key:value pairs in descriptions until they evolve into standard properties
        "description": comments,
        "duration": "PT" + durationInHours + "H",
        "expires": expiration,
        "recipient": {
          "identifier": fundedId,
        },
        "agent": {
          "identifier": funderId
        },
        "numberOfTransfersAllowed": transfersAllowed,
        "termsOfService": termsOfService,
        "identifier": grantId,
      }
    }

    function grantClaimFromInputs() {
      return grantClaim(
        crypto.randomBytes(16).toString('hex'), // 128 bits seems OK
        props.sponsorId,
        fundedId,
        comment,
        durationInHours,
        expiration,
        termsOfService,
        multipleTransfersAllowed ? Number.MAX_SAFE_INTEGER : transferAllowed ? 1 : 0
      )
    }

    return (
      <Modal
        animationType="slide"
        transparent={true}
        onRequestClose={props.cancel}
      >
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <View>
              <Text style={styles.modalText}>Give Time</Text>

              <View style={{ padding: 5 }}>
                <Text>Recipient</Text>
                <TextInput
                  value={fundedId}
                  onChangeText={setFundedId}
                  editable
                  style={{ borderWidth: 1 }}
                  autoCapitalize={'none'}
                  autoCorrect={false}
                />
              </View>

              <View style={{ padding: 5 }}>
                <Text>Number of Hours</Text>
                <TextInput
                  value={durationInHours}
                  onChangeText={setDurationInHours}
                  editable
                  length={ 5 }
                  style={{ borderWidth: 1 }}
                />
              </View>

              <View style={{ padding: 5 }}>
                <Text>Expiration</Text>
                <TextInput
                  value={expiration}
                  onChangeText={setExpiration}
                  editable
                  style={{ borderWidth: 1 }}
                />
              </View>

              <View style={{ padding: 5 }}>
                <Text>Comment</Text>
                <TextInput
                  value={comment}
                  onChangeText={setComment}
                  editable
                  multiline={true}
                  style={{ borderWidth: 1 }}
                />
              </View>

              <View style={{ padding: 5 }}>
                <Text>Terms</Text>
                <TextInput
                  value={termsOfService}
                  onChangeText={setTermsOfService}
                  editable
                  multiline={true}
                  style={{ borderWidth: 1 }}
                />
              </View>

              <View style={{ padding: 5 }}>
                <CheckBox
                  title='Transfer Allowed'
                  checked={transferAllowed}
                  onPress={() => {setTransferAllowed(!transferAllowed)}}
                />
                <View style={{ padding: 5, display: (transferAllowed ? 'flex' : 'none') }}>
                  <CheckBox
                    title='Multiple Transfers Allowed?'
                    checked={multipleTransfersAllowed}
                    onPress={() => {setMultipleTransfersAllowed(!multipleTransfersAllowed)}}
                    visible={transferAllowed}
                  />
                </View>
              </View>

              <View style={{ padding: 10 }} />
              <TouchableHighlight
                style={styles.saveButton}
                onPress={() => props.proceed(grantClaimFromInputs())}
              >
                <Text>Set...</Text>
              </TouchableHighlight>
              <View style={{ padding: 5 }} />
              <TouchableHighlight
                style={styles.cancelButton}
                onPress={props.cancel}
              >
                <Text>Cancel</Text>
              </TouchableHighlight>
            </View>
          </View>
        </View>
      </Modal>
    )
  }

  /**
    props has:
    - agent string for the identifier of the provider
    - pledge string for the promise being made
    - proceed function that takes the claim
    - cancel function
   **/
  function PledgeModal(props) {

    const [pledge, setPledge] = useState<string>(props.pledge)

    function constructPledge() {
      return {
        "@context": "http://schema.org",
        "@type": "AcceptAction",
        "agent": props.agent,
        "object": pledge,
      }
    }

    return (
      <Modal
        animationType="slide"
        transparent={true}
        onRequestClose={props.cancel}
      >
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <View>
              <Text style={styles.modalText}>Accept</Text>

              <View style={{ padding: 5 }}>
                <TextInput
                  value={pledge}
                  onChangeText={setPledge}
                  editable
                  style={{ borderWidth: 1 }}
                  multiline={true}
                />
              </View>

              <View style={{ padding: 10 }} />
              <TouchableHighlight
                style={styles.saveButton}
                onPress={() => props.proceed(constructPledge())}
              >
                <Text>Set...</Text>
              </TouchableHighlight>
              <View style={{ padding: 5 }} />
              <TouchableHighlight
                style={styles.cancelButton}
                onPress={props.cancel}
              >
                <Text>Cancel</Text>
              </TouchableHighlight>

            </View>
          </View>
        </View>
      </Modal>
    )
  }

  /**
    props has:
    - text - string with the text of what was seen
    - proceed - function that takes the claim
    - cancel - function to cancel action
   **/
  function WitnessModal(props) {

    const [identifier, setIdentifier] = useState<string>('')
    const [selectFromContacts, setSelectFromContacts] = useState<boolean>(false)
    const [text, setText] = useState<string>(props.text)

    const allContacts = useSelector((state) => state.contacts || [])

    function constructWitness() {
      return {

        // We might prefer this but the URLs don't resolve.
        // https://lov.linkeddata.es/dataset/lov/terms?q=appreciate

        "@context": "http://schema.org",
        "@type": "WatchAction",
        "about": identifier,
        "text": text,
      }
    }

    return (
      <Modal
        animationType="slide"
        transparent={true}
        onRequestClose={props.cancel}
      >
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            {
              selectFromContacts
              ? <ContactSelectModal
                  cancel={ () => { setSelectFromContacts(false) } }
                  proceed={ (did) => { setIdentifier(did); setSelectFromContacts(false) }}
                />
              : <View/>
            }

            <View>
              <Text style={styles.modalText}>Witness</Text>

              <View style={{ padding: 5 }}>
                <Text>Identifier</Text>
                <TextInput
                  value={identifier}
                  onChangeText={setIdentifier}
                  editable
                  style={{ borderWidth: 1, width: 300 }}
                  autoCapitalize={'none'}
                  autoCorrect={false}
                />
                {
                  allContacts.length > 0
                  ? <TouchableHighlight
                      style={styles.moreButton}
                      onPress={() => setSelectFromContacts(true)}
                    >
                      <Text>Pick</Text>
                    </TouchableHighlight>
                  : <View />
                }
              </View>

              <View style={{ marginTop: 20 }}>
                <Text>What I Saw</Text>
                <TextInput
                  value={text}
                  onChangeText={setText}
                  editable
                  style={{ borderWidth: 1 }}
                  multiline={true}
                />
              </View>

              <View style={{ padding: 10 }} />
              <TouchableHighlight
                style={styles.saveButton}
                onPress={() => props.proceed(constructWitness())}
              >
                <Text>Set...</Text>
              </TouchableHighlight>
              <View style={{ padding: 5 }} />
              <TouchableHighlight
                style={styles.cancelButton}
                onPress={props.cancel}
              >
                <Text>Cancel</Text>
              </TouchableHighlight>

            </View>
          </View>
        </View>
      </Modal>
    )
  }

}
