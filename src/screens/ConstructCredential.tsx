import Debug from 'debug'
import { DateTime, Duration } from 'luxon'
import * as R from 'ramda'
import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Button, Linking, Modal, SafeAreaView, ScrollView, Text, TextInput, TouchableHighlight, TouchableOpacity, View } from 'react-native'
import { CheckBox } from "react-native-elements"
import RadioGroup, {RadioButtonProps} from 'react-native-radio-buttons-group'
import { useSelector } from 'react-redux'

import { ContactSelectModal } from './ContactSelectModal'
import { ItemSelectModal } from './ItemSelectModal'
import { styles } from './style'
import { onboarding } from '../data/onboarding'
import * as utility from '../utility/utility'
import { BVCButton } from '../utility/utility.tsx'
import { appSlice, appStore } from '../veramo/appSlice'
import { HANDY_APP } from "../veramo/setup";
import Icon from "react-native-vector-icons/FontAwesome";
import { BookmarkSelectModal } from "./BookmarkSelectModal";
import { isGlobalUri } from "../utility/utility";

const debug = Debug('endorser-mobile:share-credential')

const INITIAL_UNIT_BUTTONS: RadioButtonProps[] = [{
  id: '1', // acts as primary key, should be unique and non-empty string
  label: 'hours',
  selected: true,
  value: 'HUR',
}, {
  id: '2',
  label: 'bitcoin',
  value: 'BTC',
}, {
  id: '3',
  label: 'dollars',
  value: 'USD',
}, {
  id: '4',
  label: 'other',
  value: '',
}]
const INITIAL_SELECTED_BUTTON = R.find(R.prop('selected'), INITIAL_UNIT_BUTTONS)

export function ConstructCredentialScreen({ navigation, route }) {

  const { incomingClaim } = route.params || {}

  const [askForClaimInfo, setAskForClaimInfo] = useState<boolean>(false)
  const [askForGaveInfo, setAskForGaveInfo] = useState<boolean>(false)
  const [askForOfferInfo, setAskForOfferInfo] = useState<boolean>(false)
  const [askForPersonInfo, setAskForPersonInfo] = useState<boolean>(false)
  const [askForPlanInfo, setAskForPlanInfo] = useState<boolean>(false)
  const [askForPledgeAbout, setAskForPledgeAbout] = useState<string>('')
  const [askForPledgeInfo, setAskForPledgeInfo] = useState<string>('')
  const [askForWitnessInfo, setAskForWitnessInfo] = useState<string>('')
  const [hasMnemonic, setHasMnemonic] = useState<boolean>(false)

  const identifiers = useSelector((state) => state.identifiers)
  const settings = useSelector((state) => state.settings)

  // Check for existing identifers on load and set them to state
  useEffect(() => {
    const getSettings = async () => {
      if (settings && (settings.mnemEncrBase64 || settings.mnemonic)) {
        setHasMnemonic(true)
      }
      if (incomingClaim != null) {
        if (utility.isOffer(incomingClaim)) {
          setAskForOfferInfo(true)
        } else if (utility.isGiveAction(incomingClaim)) {
          setAskForGaveInfo(true)
        } else if (utility.isPlanAction(incomingClaim)) {
          setAskForPlanInfo(true)
        }
      }
    }
    getSettings()
  }, [])

  return (
    <SafeAreaView>
      <ScrollView>
        <View style={{ padding: 20 }}>
          { identifiers && identifiers[0] ? (
            <View>
              <Text style={{ fontSize: 30, fontWeight: 'bold' }}>Create</Text>
              { !hasMnemonic ? (
                <Text style={{ padding: 10, color: 'red' }}>There is no backup available for this ID. We recommend you generate a different identifier and do not keep using this one. (See Help.)</Text>
              ) : (
                 <Text/>
              )}
              <View style={{ padding: 10 }}>
                {
                  askForClaimInfo
                  ? <ClaimModal
                      cancel={ () => setAskForClaimInfo(false) }
                      proceed={ claim => {
                        setAskForClaimInfo(false)
                        navigation.push(utility.REVIEW_SIGN_SCREEN_NAV, { credentialSubject: claim })
                      }}
                    />
                  : <View/>
                }
                {
                  askForGaveInfo
                  ? <GaveModal
                      cancel={ () => setAskForGaveInfo(false) }
                      proceed={ claim => {
                        setAskForGaveInfo(false)
                        navigation.push(utility.REVIEW_SIGN_SCREEN_NAV, { credentialSubject: claim })
                      }}
                      userId={ identifiers[0].did }
                    />
                  : <View/>
                }
                {
                  askForOfferInfo
                  ? <OfferModal
                      cancel={ () => setAskForOfferInfo(false) }
                      proceed={ claim => {
                        setAskForOfferInfo(false)
                        navigation.push(utility.REVIEW_SIGN_SCREEN_NAV, { credentialSubject: claim })
                      }}
                      userId={ identifiers[0].did }
                    />
                  : <View/>
                }
                {
                  askForPlanInfo
                  ? <PlanModal
                      userId={ identifiers[0].did }
                      cancel={ () => setAskForPlanInfo(false) }
                      proceed={ claim => {
                        setAskForPlanInfo(false)
                        navigation.push(utility.REVIEW_SIGN_SCREEN_NAV, { credentialSubject: claim })
                      }}
                    />
                  : <View/>
                }
                {
                  askForPersonInfo
                  ? <PersonModal
                      identifier={ identifiers[0].did }
                      cancel={ () => setAskForPersonInfo(false) }
                      proceed={ claim => {
                        setAskForPersonInfo(false)
                        navigation.push(utility.REVIEW_SIGN_SCREEN_NAV, { credentialSubject: claim })
                      }}
                    />
                  : <View/>
                }
                {
                  askForPledgeInfo
                  ? <PledgeModal
                      about={ askForPledgeAbout }
                      agent={ identifiers[0].did }
                      pledge={ askForPledgeInfo }
                      cancel={ () => { setAskForPledgeAbout(''); setAskForPledgeInfo(''); } }
                      proceed={ claim => {
                        setAskForPledgeAbout('')
                        setAskForPledgeInfo('')
                        navigation.push(utility.REVIEW_SIGN_SCREEN_NAV, { credentialSubject: claim })
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
                        navigation.push(utility.REVIEW_SIGN_SCREEN_NAV, { credentialSubject: claim })
                      }}
                    />
                  : <View/>
                }
                <View>
                {
                !HANDY_APP
                ?
                  <View>
                    <Text>What do you want to assert?</Text>

                    <View style={{ padding: 5 }} />
                    <View style={{ backgroundColor: 'rgba(0,0,0,0.9)', height: 0.8, width: '30%' }}/>
                    <Text>Contributions</Text>

                    <View style={{ padding: 5 }} />
                    <Button
                      title={'Gave'}
                      onPress={() => setAskForGaveInfo(true)}
                    />

                    <View style={{ padding: 5 }} />
                    <Button
                      title={'Offer'}
                      onPress={() => setAskForOfferInfo(true)}
                    />

                    <View style={{ padding: 5 }} />
                    <Button
                      title={'Plan'}
                      onPress={() => setAskForPlanInfo(true)}
                    />

                    <View style={{ padding: 5 }} />
                    <View style={{ backgroundColor: 'rgba(0,0,0,0.9)', height: 0.8, width: '30%' }}/>
                    <Text>Pledges</Text>

                    <View style={{ padding: 5 }} />
                    <Button
                      title={'Pledge A Life Of Gifts'}
                      onPress={() => {
                        setAskForPledgeAbout("See Basic Giving Pledge at LivesOfGifts.org")
                        setAskForPledgeInfo("I am building a gifting society, in ways that fulfill me.")
                      }}
                    />

                    <View style={{ padding: 5 }} />
                    <Button
                      title={'Make Voluntary Pledge for A Life Of Gifts'}
                      onPress={() => {
                        setAskForPledgeAbout("See Voluntary Pledge at LivesOfGifts.org")
                        setAskForPledgeInfo("I am creating society run by mutual agreement, where more and more organization evolves naturally and voluntarily.")
                      }}
                    />

                    <View style={{ padding: 5 }} />
                    <Button
                      title={'Make Pursuit Pledge for A Life Of Gifts'}
                      onPress={() => {
                        setAskForPledgeAbout("See Pursuit Pledge at LivesOfGifts.org")
                        setAskForPledgeInfo("I am helping everyone pursue what they love, where less and less effort is spent on basic needs and fears.")
                      }}
                    />

                    <View style={{ padding: 5 }} />
                    <Button
                      title={'Pledge To Thick Red Line'}
                      onPress={() => {
                        setAskForPledgeAbout("See ThickRedLine.org")
                        setAskForPledgeInfo("I recognize natural law, basic morality, and the Non-Aggression Principle, and I understand that it is morally and logically impossible for the government and/or my badge to confer rights upon me that the population does not have and cannot delegate. I pledge only to act to protect lives, liberty, and property. I renounce the use of force or coercion on peaceful people where there is no victim to defend or protect.")
                      }}
                    />

                    <View style={{ padding: 5 }} />
                    <Button
                      title={'Pledge To Mutual Integrity'}
                      onPress={() => {
                        setAskForPledgeAbout("Copyright 2021 Mutual Integrity Foundation")
                        setAskForPledgeInfo("I pledge to honor my word as my bond and support others as peers in acting with integrity. I accept that dishonoring my word and this pledge will result in a breach of integrity as recorded on my reputation slate until I measure the impact and make amends.")
                      }}
                    />

                    <View style={{ padding: 5 }} />
                    <Button
                      title={'Pledge Honesty As An Officer'}
                      onPress={() => {
                        setAskForPledgeAbout("This gives citizens confidence to interact.")
                        setAskForPledgeInfo("I commit to tell only the truth when identifying as a government representative.")
                      }}
                    />

                    <View style={{ padding: 5 }} />
                    <Button
                      title={'Pledge Liberty'}
                      onPress={() => {
                        setAskForPledgeAbout("h/t Stewart Brand, Buddha, & Ayn Rand")
                        setAskForPledgeInfo("We are as gods. I dedicate myself to reach my full potential. I will never ask another person to live for my sake.")
                      }}
                    />

                  </View>
                :
                  <View/>
                }

                  <View style={{ padding: 5 }} />
                  <View style={{ backgroundColor: 'rgba(0,0,0,0.9)', height: 0.8, width: '30%' }}/>
                  <Text>Contracts</Text>

                  <View style={{ padding: 5 }} />
                  <Button
                    title={'Common Paper Mutual NDA'}
                    onPress={() => navigation.push(
                      'Contract Form',
                      {
                        nextScreen: utility.REVIEW_SIGN_SCREEN_NAV,
                        onboardingChoice: onboarding.common_paper_mnda,
                      }
                    )}
                  />

                  <View style={{ padding: 5 }} />
                  <Button
                    title={'C30 Master Collaboration Agreement'}
                    onPress={() => navigation.push(
                      'Contract Form',
                      { nextScreen: utility.REVIEW_SIGN_SCREEN_NAV, onboardingChoice: onboarding.c30_mca }
                    )}
                  />

                  <View style={{ padding: 5 }} />
                  <View style={{ backgroundColor: 'rgba(0,0,0,0.9)', height: 0.8, width: '30%' }}/>
                  <Text>Miscellaneous</Text>

                  <View style={{ padding: 5 }} />
                  <Button
                    title={'Advertise or Seek Skills or Services'}
                    onPress={() => setAskForPersonInfo(true)}
                  />

                  <View style={{ padding: 5 }} />
                  <BVCButton
                    description='BVC Meeting'
                    identifier={ identifiers[0] }
                    navigation={ navigation }
                  />

                  <View style={{ padding: 5 }} />
                  <Button
                    title={'Witness To Something Remarkable'}
                    onPress={() => setAskForWitnessInfo("They ")}
                  />

                  <View style={{ padding: 5 }} />
                  <View style={{ backgroundColor: 'rgba(0,0,0,0.9)', height: 0.8, width: '30%' }}/>
                  <Text>Other Tools</Text>

                  <View style={{ padding: 5 }} />
                  <Button
                    title={'Scan For Claim'}
                    onPress={() =>
                      navigation.push(
                        'Scan Content',
                        {
                          nextData: { substitute: true },
                          nextScreen: utility.REVIEW_SIGN_SCREEN_NAV,
                          title: 'Scan Claim Template',
                        }
                      )
                    }
                  />

                  <View style={{ padding: 5 }} />
                  <Button
                    title={'Paste Claim'}
                    onPress={() => setAskForClaimInfo(true)}
                  />

                </View>
                <View style={{ padding: 5 }} />
                <View style={{ backgroundColor: 'rgba(0,0,0,0.9)', height: 0.8, width: '100%' }}/>
                <Text>Note that you can use any of those as a template and then edit before signing the final record.</Text>
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
    - proceed function that takes the claim
    - cancel function
   **/
  function ClaimModal(props) {

    const [json, setJson] = useState<string>('')

    return (
      <Modal
        animationType="slide"
        transparent={true}
        onRequestClose={props.cancel}
      >
        <ScrollView>
          <View style={styles.centeredView}>
            <View style={styles.modalView}>
              <View>
                <Text style={styles.modalText}>JSON Input</Text>

                <View style={{ padding: 5 }}>
                  <TextInput
                    value={json}
                    onChangeText={setJson}
                    editable
                    style={{ borderWidth: 1 }}
                    multiline={true}
                  />
                </View>

                <View style={{ padding: 10 }} />
                <TouchableHighlight
                  style={styles.saveButton}
                  onPress={() => props.proceed(JSON.parse(json))}
                >
                  <Text>Finish...</Text>
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
        </ScrollView>
      </Modal>
    )
  }

  /**
    props has:
    - providerId string for the identifier of the provider
    - recipientId string for the identifier of the recipient
    - proceed function that takes the claim
    - cancel function
   **/
  /** unused
  function CreditModal(props) {

    const [amountStr, setAmountStr] = useState<string>('')
    const [currency, setCurrency] = useState<string>('')
    const [description, setDescription] = useState<string>('')
    const [expiration, setExpiration] = useState<string>(DateTime.local().plus(Duration.fromISO("P6M")).toISODate())
    const [recipientId, setRecipientId] = useState<string>('')
    const [selectFromContacts, setSelectFromContacts] = useState<boolean>(false)
    const [termsOfService, setTermsOfService] = useState<string>("Recipient may acknowledge receipt of terms (with AcceptAction). Recipient will log final payment (with GiveAction) and provider will agree (with AgreeAction).")
    const [transferAllowed, setTransferAllowed] = useState<boolean>(true)
    const [multipleTransfersAllowed, setMultipleTransfersAllowed] = useState<boolean>(false)

    const allContacts = useSelector((state) => state.contacts || [])

    function loanOrCreditClaim(providerId: string, recipientId: string, amount: number, currency: string, description: string, termsOfService: string, transfersAllowed: number) {
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
      }
    }

    function loanOrCreditClaimFromInputs() {
      return loanOrCreditClaim(
        props.providerId,
        props.recipientId,
        Number(amountStr),
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
        <ScrollView>
          <View style={styles.centeredView}>
            <View style={styles.modalView}>

              {
                selectFromContacts
                ? <ContactSelectModal
                    cancel={ () => { setSelectFromContacts(false) } }
                    proceed={ (did) => { setRecipientId(did); setSelectFromContacts(false) }}
                    includeMyDid={ identifiers[0].did }
                  />
                : <View/>
              }

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
                  {
                    allContacts.length > 0
                    ? <TouchableHighlight
                        style={styles.moreButton}
                        onPress={() => setSelectFromContacts(true)}
                      >
                        <Text>Pick from Contacts</Text>
                      </TouchableHighlight>
                    : <View />
                  }
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
                  <Text>Kind of Currency (eg. USD, BTC)</Text>
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
                  onPress={() => props.proceed(loanOrCreditClaimFromInputs())}
                >
                  <Text>Finish...</Text>
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
        </ScrollView>
      </Modal>
    )
  }
  **/

  /**
    props has:
    - funderId string for the identifier of the sponsor
    - kind string is "money" or "time"
    - proceed function that takes the claim
    - cancel function
   **/
  /** unused
  function DonationModal(props) {

    const [comment, setComment] = useState<string>('')
    const [amountStr, setAmountStr] = useState<string>('1')
    const [currency, setCurrency] = useState<string>(props.kind === 'time' ? 'HUR' : '')
    const [expiration, setExpiration] = useState<string>(DateTime.local().plus(Duration.fromISO("P6M")).toISODate())
    const [fundedId, setFundedId] = useState<string>('')
    const [selectFromContacts, setSelectFromContacts] = useState<boolean>(false)
    const [termsOfService, setTermsOfService] = useState<string>("We talk beforehand about reasonable terms such as location, advance notice, amount of exertion, etc. Recipient will record delivery with a confirming AcceptAction.")
    const [transferAllowed, setTransferAllowed] = useState<boolean>(true)
    const [multipleTransfersAllowed, setMultipleTransfersAllowed] = useState<boolean>(false)

    const allContacts = useSelector((state) => state.contacts || [])

    function donateClaim(funderId: string, fundedId: string, price: number, priceCurrency: string, comments: string, expiration: string, termsOfService: string, transfersAllowed: number) {
      return {
        "@context": "https://schema.org",

        "@type": "DonateAction",

        "description": comments,
        "agent": {
          "identifier": funderId,
        },
        "recipient": {
          "identifier": fundedId,
        },

        "price": price,

        // eg. ISO 4217 or UN/CEFACT Common Codes; see https://schema.org/price
        "priceCurrency": priceCurrency,

        //-- The rest are not in the schema.org spec for DonateAction.

        "expires": expiration,
        "termsOfService": termsOfService,

        //-- The rest are new, not in the schema.org spec anywhere.

        "numberOfTransfersAllowed": transfersAllowed,
      }
    }

    function donateClaimFromInputs() {
      return donateClaim(
        props.sponsorId,
        fundedId,
        Number(amountStr),
        currency,
        comment,
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
        <ScrollView>
          <View style={styles.centeredView}>
            <View style={styles.modalView}>

              {
                selectFromContacts
                ? <ContactSelectModal
                    cancel={ () => { setSelectFromContacts(false) } }
                    proceed={ (did) => { setFundedId(did); setSelectFromContacts(false) }}
                    includeMyDid={ identifiers[0].did }
                  />
                : <View/>
              }

              <View>
                <Text style={styles.modalText}>Offer Donation</Text>

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
                  {
                    allContacts.length > 0
                    ? <TouchableHighlight
                        style={styles.moreButton}
                        onPress={() => setSelectFromContacts(true)}
                      >
                        <Text>Pick from Contacts</Text>
                      </TouchableHighlight>
                    : <View />
                  }
                </View>

                <View style={{ padding: 5 }}>
                  <Text>{ props.kind === 'money' ? 'Amount of Currency' : 'Number of Hours' }</Text>
                  <TextInput
                    value={amountStr}
                    onChangeText={setAmountStr}
                    editable
                    length={ 5 }
                    style={{ borderWidth: 1 }}
                  />
                </View>

                {
                  props.kind === 'money' ? (
                    <View style={{ padding: 5 }}>
                      <Text>Kind of Currency (eg. USD, BTC)</Text>
                      <TextInput
                        value={currency}
                        onChangeText={setCurrency}
                        editable
                        length={ 5 }
                        style={{ borderWidth: 1 }}
                      />
                    </View>
                  ) : (
                    <View/>
                  )
                }

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
                      title='Multiple Transfers Allowed'
                      checked={multipleTransfersAllowed}
                      onPress={() => {setMultipleTransfersAllowed(!multipleTransfersAllowed)}}
                      visible={transferAllowed}
                    />
                  </View>
                </View>

                <View style={{ padding: 10 }} />
                <TouchableHighlight
                  style={styles.saveButton}
                  onPress={() => props.proceed(donateClaimFromInputs())}
                >
                  <Text>Finish...</Text>
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
        </ScrollView>
      </Modal>
    )
  }
  **/

  /**
    props has:

    - proceed function that takes the claim
    - cancel function
   **/
  function GaveModal(props) {

    const [agentId, setAgentId] = useState<string>('')
    const [amountStr, setAmountStr] = useState<number>('')
    const [invoiceIdentifier, setInvoiceIdentifier] = useState<string>('')
    const [description, setDescription] = useState<string>(null)
    const [fulfillsId, setFulfillsId] = useState<string>('')
    const [fulfillsType, setFulfillsType] = useState<string>('')
    const [isFulfills, setIsFulfills] = useState<boolean>(false)
    const [isSpecificAmount, setIsSpecificAmount] = useState<boolean>(false)
    const [isTrade, setIsTrade] = useState<boolean>(false)
    const [providerIds, setProviderIds] = useState<string>('')
    const [recipientId, setRecipientId] = useState<string>(props.userId)
    const [selectAgentFromContacts, setSelectAgentFromContacts] = useState<boolean>(false)
    const [selectFulfillsFromBookmarks, setSelectFulfillsFromBookmarks] = useState<boolean>(false)
    const [selectProviderFromContacts, setSelectProviderFromContacts] = useState<boolean>(false)
    const [selectRecipientFromContacts, setSelectRecipientFromContacts] = useState<boolean>(false)
    const [showInfoModal, setShowInfoModal] = useState<boolean>(false)
    const [unit, setUnit] = useState<string>(INITIAL_SELECTED_BUTTON && INITIAL_SELECTED_BUTTON.value)
    const [unitButtons, setUnitButtons] = useState<RadioButtonProps[]>(INITIAL_UNIT_BUTTONS)

    const allContacts = useSelector((state) => state.contacts || [])

    function toggleIsFulfills() {
      setIsFulfills((curVal) => !curVal);
    }

    function toggleIsSpecificAmount() {
      setIsSpecificAmount((curVal) => !curVal);
    }

    function setUnitSelection(buttons) {
      setUnitButtons(buttons)
      const selectedButton = R.find(R.prop('selected'), buttons)
      setUnit(selectedButton.value)
    }

    function addProviderId(did) {
      if (providerIds.length > 0) {
        setProviderIds(providerIds + ',' + did)
      } else {
        setProviderIds(did)
      }
    }

    function possiblyFinish(proceedToFinish) {
      if (!isSpecificAmount && !description) {
        Alert.alert('You must give an amount or describe it.')
      } else if (isSpecificAmount && (!amountStr || !unit)) {
        Alert.alert('You must give a specific amount and unit.')
      } else if (isSpecificAmount && isNaN(Number(amountStr))) {
        Alert.alert('You must give a valid numeric amount.')
      } else {
        let result = {
          "@context": "https://schema.org",
          "@type": "GiveAction",
        }

        result.agent = agentId ? { identifier: agentId } : undefined
        result.recipient = recipientId ? { identifier: recipientId } : undefined

        if (isFulfills) {
          result.fulfills = {}
          if (fulfillsId) {
            if (isGlobalUri(fulfillsId)) {
              result.fulfills.identifier = fulfillsId
            } else {
              result.fulfills.lastClaimId = fulfillsId
            }
          }
          if (fulfillsType) {
            result.fulfills["@type"] = fulfillsType
          }
          if (!fulfillsId) {
            // only use if there's no ID to look up and the type isn't provided
            if (isTrade) {
              result.fulfills["@type"] = "TradeAction"
            }
          }
        }

        if (isSpecificAmount) {
          result.object = {
            // TypeAndQuantityNode
            amountOfThisGood: Number(amountStr),
            unitCode: unit,
          }
        }

        if (providerIds) {
          const allIds = R.reject(R.isEmpty, R.split(/[\s\,]/, providerIds))
          result.provider = R.map((id) => ({ identifier: id }), allIds)
        }

        result.identifier = invoiceIdentifier || undefined
        result.description = description || undefined
        proceedToFinish(result)
      }
    }

    useEffect(() => {
      if (utility.isGiveAction(incomingClaim)) {
        if (incomingClaim.fulfills) {
          setIsFulfills(true)
          setFulfillsId(
            incomingClaim.fulfills.identifier
            || incomingClaim.fulfills.lastClaimId
          )
          setFulfillsType(incomingClaim.fulfills["@type"])
          setRecipientId('')
        }
        if (incomingClaim.provider) {
          setProviderIds(R.join(',', R.map(R.prop('identifier'), incomingClaim.provider)))
          setRecipientId('')
        }
      }
    }, [])

    return (
      <Modal
        animationType="slide"
        transparent={true}
        onRequestClose={props.cancel}
      >
        <ScrollView>
          <View style={styles.centeredView}>
            <View style={styles.modalView}>

              <View>
                <Text style={styles.modalText}>Gave</Text>
                <Text>You can simply fill out the description.</Text>
                <Text>Note that you are the recipient by default.</Text>

                <View style={{ padding: 5 }}>
                  <Text>Giver</Text>
                  <TextInput
                    value={agentId}
                    onChangeText={setAgentId}
                    editable
                    style={{ borderWidth: 1 }}
                    autoCapitalize={'none'}
                    autoCorrect={false}
                  />
                  {
                    allContacts.length > 0
                    ? <TouchableHighlight
                        style={styles.moreButton}
                        onPress={() => setSelectAgentFromContacts(true)}
                      >
                        <Text>Pick from Contacts</Text>
                      </TouchableHighlight>
                    : <View />
                  }
                </View>

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
                  {
                    allContacts.length > 0
                      ? <TouchableHighlight
                        style={styles.moreButton}
                        onPress={() => setSelectRecipientFromContacts(true)}
                      >
                        <Text>Pick from Contacts</Text>
                      </TouchableHighlight>
                      : <View />
                  }
                </View>

                <CheckBox
                  title='Given for a project, offer, etc'
                  checked={isFulfills}
                  onPress={toggleIsFulfills}
                />
                {
                  isFulfills
                  ? (
                    <View style={{ padding: 15 }}>
                      <Text>ID of Project, Offer, Donation, Trade, etc</Text>
                      <TextInput
                        value={fulfillsId}
                        onChangeText={(text) => {
                          setFulfillsId(text)
                          setIsTrade(false)
                        }}
                        editable
                        multiline={false}
                        style={{ borderWidth: 1 }}
                      />
                      {
                        <TouchableHighlight
                          style={styles.moreButton}
                          onPress={() => setSelectFulfillsFromBookmarks(true)}
                        >
                          <Text>Pick from Bookmarks</Text>
                        </TouchableHighlight>
                      }

                      {
                        !fulfillsId
                        ? (
                          <View style={{ marginTop: 10 }}>
                            <Text>Since you don't have an ID:</Text>
                            <CheckBox
                              title="Check if this is part of a trade (and not a donation)."
                              checked={isTrade}
                              onPress={() => setIsTrade(!isTrade)}
                            />
                          </View>
                        ) : (
                          <View />
                        )
                      }
                    </View>
                  ) : (
                    <View />
                  )
                }

                <CheckBox
                  title="Specify an amount"
                  checked={isSpecificAmount}
                  onPress={toggleIsSpecificAmount}
                />

                {
                  isSpecificAmount ? (
                    <View style={{ padding: 5 }}>
                      <View style={{ flexDirection: 'row', justifyContent: "center" }}>
                        <View>
                          <Text>Amount      Unit</Text>
                          <View style={{ flexDirection: 'row', justifyContent: "center" }}>
                            <TextInput
                              value={amountStr}
                              onChangeText={setAmountStr}
                              editable
                              style={{ borderWidth: 1 }}
                              height={ 40 }
                              width={ 50 }
                            />
                            <TextInput
                              value={unit}
                              onChangeText={setUnit}
                              editable={ !R.find(R.prop('selected'), unitButtons).value }
                              style={{ borderWidth: 1 }}
                              height={ 40 }
                              width={ 50 }
                            />
                          </View>
                        </View>
                        <RadioGroup
                          radioButtons={unitButtons}
                          onPress={setUnitSelection}
                        />
                      </View>
                      {
                        (R.find(R.prop('selected'), unitButtons).value == '') ? (
                          <Text>
                              You can see the <Text style={{ color: 'blue' }} onPress={() => Linking.openURL('https://www.xe.com/iso4217.php')}>codes for currencies here</Text> and the <Text style={{ color: 'blue' }} onPress={() => Linking.openURL('http://wiki.goodrelations-vocabulary.org/Documentation/UN/CEFACT_Common_Codes')}>codes for other units here</Text>.
                          </Text>
                        ) : (
                          <View/>
                        )
                      }

                    </View>
                  ) : (
                    <View />
                  )
                }

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
                  <Text>
                    Other Provider(s)
                    &nbsp;
                    <Icon
                      name="info-circle"
                      onPress={() => setShowInfoModal(!showInfoModal) }
                      size={ 18 }
                    />
                  </Text>
                  {
                    showInfoModal
                    ? (
                      <Text>
                        This is a list of other contributors who helped
                        make this possible.
                        Use handle IDs for other Gives or Plans or Organizations.
                        Separate each with spaces or commas.
                      </Text>
                    ) : (
                      <View />
                    )
                  }
                  <TextInput
                    value={providerIds}
                    onChangeText={setProviderIds}
                    editable
                    multiline={true}
                    style={{ borderWidth: 1 }}
                  />
                  {
                    <TouchableHighlight
                      style={styles.moreButton}
                      onPress={() => setSelectProviderFromContacts(true)}
                    >
                      <Text>Pick from Contacts</Text>
                    </TouchableHighlight>
                  }
                </View>

                <View style={{ padding: 5 }}>
                  <Text>Invoice (ID)</Text>
                  <TextInput
                    value={invoiceIdentifier}
                    onChangeText={setInvoiceIdentifier}
                    style={{ borderWidth: 1 }}
                  />
                </View>

                <View style={{ padding: 10 }} />
                <TouchableHighlight
                  style={styles.saveButton}
                  onPress={() => possiblyFinish(props.proceed)}
                >
                  <Text>Finish...</Text>
                </TouchableHighlight>
                <View style={{ padding: 5 }} />
                <TouchableHighlight
                  style={styles.cancelButton}
                  onPress={props.cancel}
                >
                  <Text>Cancel</Text>
                </TouchableHighlight>
              </View>

              {
                selectAgentFromContacts
                  ? <ContactSelectModal
                    cancel={ () => { setSelectAgentFromContacts(false) } }
                    proceed={ (did) => { setAgentId(did); setSelectAgentFromContacts(false) }}
                    includeMyDid={ identifiers[0].did }
                  />
                  : <View/>
              }
              {
                selectRecipientFromContacts
                  ? <ContactSelectModal
                    cancel={ () => { setSelectRecipientFromContacts(false) } }
                    proceed={ (did) => { setRecipientId(did); setSelectRecipientFromContacts(false) }}
                    includeMyDid={ identifiers[0].did }
                  />
                  : <View/>
              }
              {
                selectFulfillsFromBookmarks
                  ? <BookmarkSelectModal
                    cancel={ () => { setSelectFulfillsFromBookmarks(false) } }
                    proceed={ (handleId) => { setFulfillsId(handleId); setSelectFulfillsFromBookmarks(false) }}
                  />
                  : <View/>
              }
              {
                selectProviderFromContacts
                  ? <ContactSelectModal
                    cancel={ () => { setSelectProviderFromContacts(false) } }
                    proceed={ (did) => { addProviderId(did); setSelectProviderFromContacts(false) }}
                    includeMyDid={ identifiers[0].did }
                  />
                  : <View/>
              }

            </View>
          </View>
        </ScrollView>
      </Modal>
    )
  }

  /**
    props has:
    - userId for the current user's ID
    - proceed function that takes the claim
    - cancel function
   **/

  function OfferModal(props) {

    const [agentId, setAgentId] = useState<string>(props.userId)
    const [amountStr, setAmountStr] = useState<string>('')
    const [invoiceIdentifier, setInvoiceIdentifier] = useState<string>('')
    const [isRequiringOffers, setIsRequiringOffers] = useState<boolean>(false)
    const [isSpecificAmount, setIsSpecificAmount] = useState<boolean>(false)
    const [isItemDescribed, setIsItemDescribed] = useState<boolean>(false)
    const [itemDescription, setItemDescription] = useState<string>(null)
    const [itemType, setItemType] = useState<string>('CreativeWork')
    const [minOffersStr, setMinOffersStr] = useState<string>('0')
    const [minOffersAmountStr, setMinOffersAmountStr] = useState<string>('0')
    const [parentIdentifier, setParentIdentifier] = useState<string>('')
    const [parentInfoReadOnly, setParentInfoReadOnly] = useState<boolean>(false)
    const [parentType, setParentType] = useState<string>('')
    const [recipientId, setRecipientId] = useState<string>(null)
    const [selectAgentFromContacts, setSelectAgentFromContacts] = useState<boolean>(false)
    const [selectItemType, setSelectItemType] = useState<boolean>(false)
    const [selectParentIdFromBookmarks, setSelectParentIdFromBookmarks] = useState<boolean>(false)
    const [selectRecipientFromContacts, setSelectRecipientFromContacts] = useState<boolean>(false)
    const [termsOfService, setTermsOfService] = useState<string>('')
    const [unit, setUnit] = useState<string>(INITIAL_SELECTED_BUTTON && INITIAL_SELECTED_BUTTON.value)
    const [unitButtons, setUnitButtons] = useState<RadioButtonProps[]>(INITIAL_UNIT_BUTTONS)
    const [validThrough, setValidThrough] = useState<string>(DateTime.local().plus(Duration.fromISO("P6M")).toISODate())

    const allContacts = useSelector((state) => state.contacts || [])

    function toggleIsItemDescribed() {
      setIsItemDescribed(!isItemDescribed)
    }

    function toggleIsSpecificAmount() {
      setIsSpecificAmount(!isSpecificAmount)
    }

    function toggleIsRequiringOffers() {
      setIsRequiringOffers(!isRequiringOffers)
    }

    function setUnitSelection(buttons) {
      setUnitButtons(buttons)
      const selectedButton = R.find(R.prop('selected'), buttons)
      setUnit(selectedButton.value)
    }

    function possiblyFinish(proceedToFinish) {

      // An embedded item is useful for later reference (via identifier).
      // Other apps may choose to use price & priceCurrency.
      if (isItemDescribed && !itemDescription) {
        Alert.alert('You must describe your offer.')
      } else if (isSpecificAmount && (!amountStr || !unit)) {
        Alert.alert('You must declare a specific amount and unit.')
      } else if (isSpecificAmount && (!amountStr || !isFinite(amountStr))) {
        Alert.alert('You must declare a valid numeric amount.')
      } else if (!isSpecificAmount && !itemDescription) {
        Alert.alert('You must describe your offer or give a specific amount.')
      } else if (isRequiringOffers && !(minOffersStr || (minOffersAmountStr && unit))) {
        Alert.alert('For minimums, give a number of offers or a total amount & units.')
      } else if (isRequiringOffers && minOffersAmountStr && !isFinite(minOffersAmountStr)) {
        Alert.alert('For a minimum amount in offers, must choose a valid number.')
      } else if (isRequiringOffers && minOffersStr && !isFinite(minOffersStr)) {
        Alert.alert('For a minimum number of offers, must choose a valid number.')
      } else if (
        isRequiringOffers
        && (!minOffersAmountStr || Number(minOffersAmountStr) <= 0)
        && (!minOffersStr || Number(minOffersStr) <= 0)
      ) {
        Alert.alert('For a minimum amount or number of offers, must choose a number above 0.')
      } else {
        let result = {
          "@context": "https://schema.org",
          "@type": "Offer",
          identifier:
            invoiceIdentifier == '' || invoiceIdentifier == null ? undefined : invoiceIdentifier,
          offeredBy: { identifier: agentId },
        }

        if (itemDescription || parentIdentifier) {
          result.itemOffered = { '@type': itemType }
          result.itemOffered.description = itemDescription || undefined
          if (parentIdentifier
              || parentType) {
            result.itemOffered.isPartOf = {}
            if (parentType) {
              result.itemOffered.idPartOf['@type'] = parentType
            }
            if (isGlobalUri(parentIdentifier)) {
              result.itemOffered.isPartOf.identifier = parentIdentifier
            } else {
              result.itemOffered.isPartOf.lastClaimId = parentIdentifier
            }
          }
        }

        if (isSpecificAmount) {
          result.includesObject = {
            // TypeAndQuantityNode
            amountOfThisGood: Number(amountStr),
            unitCode: unit,
          }
        }

        if (isRequiringOffers && (minOffersStr || minOffersAmountStr)) {
          result.actionAccessibilityRequirement = {}
          if (minOffersStr && Number(minOffersStr) > 0) {
            result.actionAccessibilityRequirement.requiresOffers =
              Number(minOffersStr)
          }
          if (minOffersAmountStr && Number(minOffersAmountStr) > 0) {
            result.actionAccessibilityRequirement.requiresOffersTotal = {
              // TypeAndQuantityNode
              amountOfThisGood: Number(minOffersAmountStr),
              unitCode: unit,
            }
          }
        }

        result.recipient = recipientId ? { identifier: recipientId } : undefined

        result.description = termsOfService || undefined

        result.validThrough = validThrough || undefined

        proceedToFinish(result)
      }
    }

    useEffect(() => {
      if (utility.isOffer(incomingClaim)) {
        const incomingOffer = incomingClaim
        if (incomingOffer.offeredBy?.identifier) {
          setAgentId(incomingOffer.offeredBy.identifier)
        }
        if (incomingOffer.identifier) {
          setInvoiceIdentifier(incomingOffer.identifier)
        }
        if (incomingOffer.includesObject && incomingOffer.includesObject['@type'] === 'TypeAndQuantityNode') {
          setAmountStr(incomingOffer.includesObject.amountOfThisGood)
          setIsSpecificAmount(true)
          setUnit(incomingOffer.includesObject.unitCode)
        }
        if (incomingOffer.itemOffered) {
          const incomingItemType = incomingOffer.itemOffered['@type']
          setItemType(incomingItemType)
          if (incomingOffer.itemOffered.isPartOf) {
            if (!incomingItemType) {
              // no type was given, so we'll assume something
              setItemType('CreativeWork')
            }
            setParentType(incomingOffer.itemOffered.isPartOf['@type'])
            setParentIdentifier(
              incomingOffer.itemOffered.isPartOf.identifier
              || incomingOffer.itemOffered.isPartOf.lastClaimId
            )
            setParentInfoReadOnly(true)
          }
        }
      }
    }, [])

    return (
      <Modal
        animationType="slide"
        transparent={true}
        onRequestClose={props.cancel}
      >
        <ScrollView>
          <View style={styles.centeredView}>
            <View style={styles.modalView}>

              <View>
                <Text style={styles.modalText}>Offer</Text>

                <View style={{ padding: 5 }}>
                  <Text>Agent</Text>
                  <TextInput
                    value={agentId}
                    onChangeText={setAgentId}
                    editable
                    style={{ borderWidth: 1 }}
                    autoCapitalize={'none'}
                    autoCorrect={false}
                  />
                  {
                    agentId != props.userId
                    ? <Text style={{ color: 'red' }}>It is very strange to put someone else as the Agent making this offer.</Text>
                    : <View />
                  }
                  {
                    allContacts.length > 0
                    ? <TouchableHighlight
                        style={styles.moreButton}
                        onPress={() => setSelectAgentFromContacts(true)}
                      >
                        <Text>Pick from Contacts</Text>
                      </TouchableHighlight>
                    : <View />
                  }
                </View>

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
                  {
                    allContacts.length > 0
                    ? <TouchableHighlight
                        style={styles.moreButton}
                        onPress={() => setSelectRecipientFromContacts(true)}
                      >
                        <Text>Pick from Contacts</Text>
                      </TouchableHighlight>
                    : <View />
                  }
                </View>

                {
                  parentInfoReadOnly
                  ? <Text style={{ padding: 5 }}>Contributes To A (Type): {parentType}</Text>
                  : <View/>
                }

                <View style={{ padding: 5 }}>
                  <Text>Contributes to Initiative (ID)</Text>
                  <TextInput
                    value={parentIdentifier}
                    onChangeText={setParentIdentifier}
                    editable={ !parentInfoReadOnly }
                    style={{ borderWidth: 1 }}
                  />
                </View>
                {
                  <TouchableHighlight
                    style={styles.moreButton}
                    onPress={() => setSelectParentIdFromBookmarks(true)}
                  >
                    <Text>Pick from Bookmarks</Text>
                  </TouchableHighlight>
                }

                <CheckBox
                  title='Describe your offering'
                  checked={isItemDescribed}
                  onPress={toggleIsItemDescribed}
                />
                {
                  isItemDescribed
                  ?
                    <View>
                      <Text style={{ padding: 5 }}>
                        Offering Type: { utility.capitalizeAndInsertSpacesBeforeCaps(itemType) }
                        &nbsp;&nbsp;
                        <TouchableHighlight
                          style={styles.moreButton}
                          onPress={() => setSelectItemType(true)}
                        >
                          <Text>Change</Text>
                        </TouchableHighlight>
                      </Text>

                      <View style={{ padding: 5 }}>
                        <Text>Offering Description</Text>
                        <TextInput
                          value={itemDescription}
                          onChangeText={setItemDescription}
                          editable={true}
                          multiline={true}
                          style={{ borderWidth: 1 }}
                        />
                      </View>
                    </View>
                  :
                    <View />
                }

                <CheckBox
                  title='Specify an amount'
                  checked={isSpecificAmount}
                  onPress={toggleIsSpecificAmount}
                />
                {
                  isSpecificAmount ? (
                    <View style={{ padding: 5 }}>
                      <View style={{ flexDirection: 'row', justifyContent: "center" }}>
                        <View>
                          <Text>Amount      Unit</Text>
                          <View style={{ flexDirection: 'row', justifyContent: "center" }}>
                            <TextInput
                              value={amountStr}
                              onChangeText={setAmountStr}
                              editable
                              style={{ borderWidth: 1 }}
                              height={ 40 }
                              width={ 50 }
                            />
                            <TextInput
                              value={unit}
                              onChangeText={setUnit}
                              editable={ !R.find(R.prop('selected'), unitButtons).value }
                              style={{ borderWidth: 1 }}
                              height={ 40 }
                              width={ 50 }
                            />
                          </View>
                        </View>
                        <RadioGroup
                          radioButtons={unitButtons}
                          onPress={setUnitSelection}
                        />
                      </View>
                      {
                        (!R.find(R.prop('selected'), unitButtons).value) ? (
                          <Text>
                              You can see the <Text style={{ color: 'blue' }} onPress={() => Linking.openURL('https://www.xe.com/iso4217.php')}>codes for currencies here</Text> and the <Text style={{ color: 'blue' }} onPress={() => Linking.openURL('http://wiki.goodrelations-vocabulary.org/Documentation/UN/CEFACT_Common_Codes')}>codes for other units here</Text>.
                          </Text>
                        ) : (
                          <View/>
                        )
                      }
                    </View>
                  ) : (
                    <View/>
                  )
                }

                <View style={{ padding: 5 }}>
                  <Text>Valid Through Date</Text>
                  <TextInput
                    value={validThrough}
                    onChangeText={setValidThrough}
                    editable
                    style={{ borderWidth: 1 }}
                  />
                </View>

                <CheckBox
                  title='Require offer minimums'
                  checked={isRequiringOffers}
                  onPress={toggleIsRequiringOffers}
                />
                {
                  isRequiringOffers ? (
                    <View>
                      <View style={{ padding: 5 }}>
                        <View style={{ flexDirection: 'row' }}>
                          <TextInput
                            value={minOffersStr}
                            onChangeText={setMinOffersStr}
                            editable
                            style={{ borderWidth: 1 }}
                            width={ 25 }
                          />
                          <Text> or more other offers</Text>
                        </View>
                      </View>

                      <View style={{ padding: 5 }}>
                        <View style={{ flexDirection: 'row' }}>
                          <TextInput
                            value={minOffersAmountStr}
                            onChangeText={setMinOffersAmountStr}
                            editable
                            style={{ borderWidth: 1 }}
                            width={ 40 }
                          />
                          <Text> or more { utility.currencyShortWordForCode(unit) } in other offers</Text>
                        </View>
                      </View>
                    </View>
                  ) : (
                    <View/>
                  )
                }

                <View style={{ padding: 5 }}>
                  <Text>Terms, Conditions, Limitations, etc</Text>
                  <TextInput
                    value={termsOfService}
                    onChangeText={setTermsOfService}
                    editable
                    multiline={true}
                    style={{ borderWidth: 1 }}
                  />
                </View>

                <View style={{ padding: 5 }}>
                  <Text>Invoice (ID)</Text>
                  <TextInput
                    value={invoiceIdentifier}
                    onChangeText={setInvoiceIdentifier}
                    style={{ borderWidth: 1 }}
                  />
                </View>

                <View style={{ padding: 10 }} />
                <TouchableHighlight
                  style={styles.saveButton}
                  onPress={() => possiblyFinish(props.proceed)}
                >
                  <Text>Finish...</Text>
                </TouchableHighlight>
                <View style={{ padding: 5 }} />
                <TouchableHighlight
                  style={styles.cancelButton}
                  onPress={props.cancel}
                >
                  <Text>Cancel</Text>
                </TouchableHighlight>
              </View>

              {
                selectAgentFromContacts
                  ? <ContactSelectModal
                    cancel={ () => { setSelectAgentFromContacts(false) } }
                    proceed={ (did) => { setAgentId(did); setSelectAgentFromContacts(false) }}
                    includeMyDid={ identifiers[0].did }
                  />
                  : <View/>
              }
              {
                selectParentIdFromBookmarks
                  ? <BookmarkSelectModal
                    cancel={ () => { setSelectParentIdFromBookmarks(false) } }
                    proceed={ (claimId) => { setParentIdentifier(claimId); setSelectParentIdFromBookmarks(false) }}
                  />
                  : <View/>
              }
              {
                selectRecipientFromContacts
                  ? <ContactSelectModal
                    cancel={ () => { setSelectRecipientFromContacts(false) } }
                    proceed={ (did) => { setRecipientId(did); setSelectRecipientFromContacts(false) }}
                    includeMyDid={ identifiers[0].did }
                  />
                  : <View/>
              }
              {
                selectItemType
                  ? <ItemSelectModal
                    list={ ['Creative Work', 'Event', 'Menu Item', 'Product', 'Service', 'Trip'] }
                    cancel={ () => { setSelectItemType(false) } }
                    proceed={ (type) => {
                      setItemType(type.replace(' ', ''))
                      setSelectItemType(false)
                    }}
                  />
                  : <View/>
              }

            </View>
          </View>
        </ScrollView>
      </Modal>
    )
  }

  /**
   props has:
   - proceed function that takes the claim
   - cancel function
   **/
  function PlanModal(props) {

    const [agentId, setAgentId] = useState<string>(props.userId)
    const [endTime, setEndTime] = useState<string>(null)
    const [fulfillsPlanId, setFulfillsPlanId] = useState<string>(null)
    const [hasConflictingPlanId, setHasConflictingPlanId] = useState<boolean>(false)
    const [loadingPlanId, setLoadingPlanId] = useState<boolean>(false)
    const [planDescription, setPlanDescription] = useState<string>(null)
    const [planIdentifier, setPlanIdentifier] = useState<string>(null)
    const [planImageUrl, setPlanImageUrl] = useState<string>(null)
    const [planName, setPlanName] = useState<string>(null)
    const [resultDescription, setResultDescription] = useState<string>(null)
    const [resultIdentifier, setResultIdentifier] = useState<string>(null)
    const [selectAgentFromContacts, setSelectAgentFromContacts] = useState<boolean>(false)
    const [selectFulfillsFromBookmarks, setSelectFulfillsFromBookmarks] = useState<boolean>(false)

    const allContacts = useSelector((state) => state.contacts || [])

    function possiblyFinish(proceedToFinish) {

      // note that the last error is what is shown
      let failureMessage

      let isoEndTime
      try {
        isoEndTime = endTime && new Date(endTime).toISOString()
      } catch (e) {
        failureMessage = 'This is not an ISO date: ' + endTime
      }

      if (!planName && !resultDescription) {
        failureMessage = 'You must give either a name or a result.'
      }

      if (failureMessage) {
        Alert.alert(failureMessage)

      } else {
        let result = {
          "@context": "https://schema.org",
          "@type": "PlanAction",
        }

        result.agent = agentId ? { identifier: agentId } : undefined
        result.description = planDescription || undefined
        result.endTime = isoEndTime || undefined
        if (fulfillsPlanId) {
          result.fulfills = {
            "@type": "PlanAction",
            identifier: fulfillsPlanId,
          }
          if (isGlobalUri(fulfillsPlanId)) {
            result.fulfills.identifier = fulfillsPlanId
          } else {
            result.fulfills.lastClaimId = fulfillsPlanId
          }
        }
        result.identifier = planIdentifier || undefined
        result.image = planImageUrl || undefined
        result.name = planName || undefined

        if (resultDescription || resultIdentifier) {
          result.result = {
            "@type": "CreativeWork",
            identifier: resultIdentifier || undefined,
            description: resultDescription || undefined
          }
        }

        proceedToFinish(result)
      }
    }

    const retrieveServerPlanByExternalId = (planId) => {
      setLoadingPlanId(true)
      return new Promise(async (resolve, reject) => {
        const endorserApiServer = appStore.getState().settings.apiServer
        const token = await utility.accessToken(identifiers[0])
        fetch(endorserApiServer + '/api/ext/plan/' + planId, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token,
          },
        })
          .then(resp => {
            if (resp.status === 200) {
              setHasConflictingPlanId(true)
            } else {
              setHasConflictingPlanId(false)
            }
            return resp.text()
          })
          .then(text => {
            //console.log('Got response body for project lookup: ', text)
          })
          .catch(err => {
            appStore.dispatch(appSlice.actions.addLog({log: false, msg: "Got error checking for project: " + err}))
            Alert.alert('Got an error checking for that plan ID. See logs for more info.')
          })
          .finally(() => {
            setLoadingPlanId(false)
            resolve()
          })
      })
    }

    const updateAndCheckPlanIdentifier = (planId) => {
      setPlanIdentifier(planId)
      retrieveServerPlanByExternalId(planId)
    }

    useEffect(() => {
      if (utility.isPlanAction(incomingClaim)) {
        setFulfillsPlanId(
          incomingClaim.fulfills?.lastClaimId
          || incomingClaim.fulfills?.identifier
        )
      }
    }, [])

    return (
      <Modal
        animationType="slide"
        transparent={true}
        onRequestClose={props.cancel}
      >
        <ScrollView>
          <View style={styles.centeredView}>
            <View style={styles.modalView}>

              {
                selectAgentFromContacts
                  ? <ContactSelectModal
                    cancel={ () => { setSelectAgentFromContacts(false) } }
                    proceed={ (did) => { setAgentId(did); setSelectAgentFromContacts(false) }}
                    includeMyDid={ identifiers[0].did }
                  />
                  : <View/>
              }

              <View>
                <Text style={styles.modalText}>Plan</Text>

                <View style={{ padding: 5 }}>
                  <Text>Planner</Text>
                  <TextInput
                    value={agentId}
                    onChangeText={setAgentId}
                    editable
                    style={{ borderWidth: 1 }}
                    autoCapitalize={'none'}
                    autoCorrect={false}
                  />
                  {
                    allContacts.length > 0
                      ? <TouchableHighlight
                        style={styles.moreButton}
                        onPress={() => setSelectAgentFromContacts(true)}
                      >
                        <Text>Pick from Contacts</Text>
                      </TouchableHighlight>
                      : <View />
                  }
                </View>

                <View style={{ padding: 5 }}>
                  <Text>Plan Name</Text>
                  <TextInput
                    value={planName}
                    onChangeText={setPlanName}
                    editable
                    multiline={false}
                    style={{ borderWidth: 1 }}
                  />
                </View>

                <View style={{ padding: 5 }}>
                  <Text>Plan Description</Text>
                  <TextInput
                    value={planDescription}
                    onChangeText={setPlanDescription}
                    editable
                    multiline={true}
                    style={{ borderWidth: 1 }}
                  />
                </View>

                <View style={{ padding: 5 }}>
                  <Text>Image (URL)</Text>
                  <TextInput
                    value={planImageUrl}
                    onChangeText={setPlanImageUrl}
                    editable
                    multiline={false}
                    style={{ borderWidth: 1 }}
                  />
                </View>

                <View style={{ padding: 5 }}>
                  <Text>Target Date</Text>
                  <TextInput
                    value={endTime}
                    onChangeText={setEndTime}
                    editable
                    multiline={true}
                    style={{ borderWidth: 1 }}
                  />
                </View>

                <View style={{ padding: 5 }}>
                  <Text>ID of Plan (for external ones)</Text>
                  {
                    loadingPlanId
                      ? <ActivityIndicator color="#00ff00" />
                      : <View />
                  }
                  {
                    hasConflictingPlanId
                      ? <Text style={{ color: 'red' }}>This project ID is taken.</Text>
                      : <View />
                  }
                  <TextInput
                    value={planIdentifier}
                    onChangeText={ newVal => updateAndCheckPlanIdentifier(newVal) }
                    editable
                    multiline={true}
                    style={{ borderWidth: 1 }}
                  />
                </View>

                <View style={{ padding: 10 }} />
                <Text style={styles.modalText}>Part Of</Text>

                <View style={{ padding: 5 }}>
                  <Text>ID of Plan This Fulfills</Text>
                  <TextInput
                    value={fulfillsPlanId}
                    onChangeText={setFulfillsPlanId}
                    editable
                    multiline={true}
                    style={{ borderWidth: 1 }}
                  />
                </View>
                {
                  <TouchableHighlight
                    style={styles.moreButton}
                    onPress={() => setSelectFulfillsFromBookmarks(true)}
                  >
                    <Text>Pick from Bookmarks</Text>
                  </TouchableHighlight>
                }

                <View style={{ padding: 10 }} />
                <Text style={styles.modalText}>Result</Text>

                <View style={{ padding: 5 }}>
                  <Text>Description of Result</Text>
                  <TextInput
                    value={resultDescription}
                    onChangeText={setResultDescription}
                    editable
                    multiline={true}
                    style={{ borderWidth: 1 }}
                  />
                </View>

                <View style={{ padding: 5 }}>
                  <Text>ID of Result</Text>
                  <TextInput
                    value={resultIdentifier}
                    onChangeText={setResultIdentifier}
                    editable
                    multiline={true}
                    style={{ borderWidth: 1 }}
                  />
                </View>

                <View style={{ padding: 10 }} />
                <TouchableHighlight
                  style={styles.saveButton}
                  onPress={() => possiblyFinish(props.proceed)}
                >
                  <Text>Finish...</Text>
                </TouchableHighlight>
                <View style={{ padding: 5 }} />
                <TouchableHighlight
                  style={styles.cancelButton}
                  onPress={props.cancel}
                >
                  <Text>Cancel</Text>
                </TouchableHighlight>

                {
                  selectFulfillsFromBookmarks
                    ? <BookmarkSelectModal
                      cancel={ () => { setSelectFulfillsFromBookmarks(false) } }
                      proceed={ (claimId) => { setFulfillsPlanId(claimId); setSelectFulfillsFromBookmarks(false) }}
                    />
                    : <View/>
                }

              </View>
            </View>
          </View>
        </ScrollView>
      </Modal>
    )
  }

  /**
    props has:
    - identifier string for the identifier of the provider
    - proceed function that takes the claim
    - cancel function... cancels
   **/
  function PersonModal(props) {

    const [knowsText, setKnowsText] = useState<string>('')
    const [located, setLocated] = useState<string>('')
    const [seeksText, setSeeksText] = useState<string>('')

    function constructPerson() {
      let result = {
        "@context": "https://schema.org",
        "@type": "Person",
        "identifier": props.identifier,
      }
      if (located) {
        result = R.mergeRight(result, { homeLocation: { address: located } })
      }
      if (knowsText) {
        result = R.mergeRight(result, { knowsAbout: knowsText })
      }
      if (seeksText) {
        result = R.mergeRight(result, { seeks: seeksText })
      }
      return result
    }

    return (
      <Modal
        animationType="slide"
        transparent={true}
        onRequestClose={props.cancel}
      >
        <ScrollView>
          <View style={styles.centeredView}>
            <View style={styles.modalView}>
              <View>

                <View>
                  <Text style={styles.modalText}>I Know About...</Text>
                  <TextInput
                    value={knowsText}
                    onChangeText={setKnowsText}
                    editable
                    style={{ borderWidth: 1 }}
                    multiline={true}
                    autoCapitalize={'none'}
                  />
                </View>

                <View style={{ padding: 20 }} />
                <View>
                  <Text style={styles.modalText}>I Am Looking For...</Text>
                  <TextInput
                    value={seeksText}
                    onChangeText={setSeeksText}
                    editable
                    style={{ borderWidth: 1 }}
                    multiline={true}
                    autoCapitalize={'none'}
                  />
                </View>

                <View style={{ padding: 20 }} />
                <View>
                  <Text style={styles.modalText}>I Am Located...</Text>
                  <TextInput
                    value={located}
                    onChangeText={setLocated}
                    editable
                    style={{ borderWidth: 1 }}
                    multiline={true}
                    autoCapitalize={'none'}
                  />
                </View>

                <View style={{ padding: 10 }} />
                <TouchableHighlight
                  style={styles.saveButton}
                  onPress={() => props.proceed(constructPerson())}
                >
                  <Text>Finish...</Text>
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
        </ScrollView>
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

    const about = props.about

    const [pledge, setPledge] = useState<string>(props.pledge)

    return (
      <Modal
        animationType="slide"
        transparent={true}
        onRequestClose={props.cancel}
      >
        <ScrollView>
          <View style={styles.centeredView}>
            <View style={styles.modalView}>
              <View>
                <Text style={styles.modalText}>Accept</Text>

                <Text>{about}</Text>

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
                  onPress={() => props.proceed(utility.constructAccept(props.agent, pledge))}
                >
                  <Text>Finish...</Text>
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
        </ScrollView>
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
        "@context": "http://purl.org/vocab/bio/0.1/",
        "@type": "Event",
        "agent": { identifier: identifier },
        "description": text,
      }
    }

    return (
      <Modal
        animationType="slide"
        transparent={true}
        onRequestClose={props.cancel}
      >
        <ScrollView>
          <View style={styles.centeredView}>
            <View style={styles.modalView}>
              {
                selectFromContacts
                ? <ContactSelectModal
                    cancel={ () => { setSelectFromContacts(false) } }
                    proceed={ (did) => { setIdentifier(did); setSelectFromContacts(false) }}
                    includeMyDid={ identifiers[0].did }
                  />
                : <View/>
              }

              <View>
                <Text style={styles.modalText}>Witness</Text>
                <Text>
                  First, consider whether this is more appropriate as a Give,
                  showing recognition for something positive given to the world.
                  That will show up in more feeds, can it can be tied to broader
                  projects.
                </Text>

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
                        <Text>Pick from Contacts</Text>
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
                  <Text>* Note that this description will be visible to the world, so beware not to include names, addresses, etc.</Text>
                </View>

                <View style={{ padding: 10 }} />
                <TouchableHighlight
                  style={styles.saveButton}
                  onPress={() => props.proceed(constructWitness())}
                >
                  <Text>Finish...</Text>
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
        </ScrollView>
      </Modal>
    )
  }

}
