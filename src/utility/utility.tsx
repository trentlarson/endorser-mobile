import { DateTime } from 'luxon'
import * as R from 'ramda'
import React, { useState } from 'react'
import { Alert, Button, Modal, Pressable, Text, TextInput, TouchableHighlight, View } from "react-native";
import Clipboard from "@react-native-community/clipboard"
import Icon from 'react-native-vector-icons/FontAwesome'
import { useSelector } from 'react-redux'

import * as utility from './utility'
import { styles } from '../screens/style'
import { appStore } from "../veramo/appSlice";
import { dbConnection } from '../veramo/setup'

function setClaimToAttendAndGive(id: IIdentifier | undefined, startTime: string, navigation) {
  const claimObjs = utility.bvcClaims(
    id ? id.did : 'UNKNOWN', startTime, appStore.getState().homeProjectId
  )
  navigation.push(utility.REVIEW_SIGN_SCREEN_NAV, { credentialSubject: claimObjs })
}

export const BVCButton = ({ identifier, navigation, description }) => {

  const todayIsSaturday = DateTime.local().weekday === 6

  return (
    <Button
      title={'Attended ' + description + ' ' + (todayIsSaturday ? 'Today' : 'Last Time')}
      onPress={() => {
        let currentOrPreviousSat = DateTime.local()
        if (currentOrPreviousSat.weekday < 6) {
          // it's not Saturday or Sunday,
          // so move back one week before setting to the Saturday
          currentOrPreviousSat = currentOrPreviousSat.minus({week:1})
        }
        const eventStartDateObj =
          currentOrPreviousSat.set({weekday:6}).set({hour:9}).startOf("hour")
        // Hack, but full ISO pushes the length to 340 which crashes verifyJWT!
        const TODAY_OR_PREV_START_DATE =
          eventStartDateObj.toISO({suppressMilliseconds:true})
        setClaimToAttendAndGive(identifier, TODAY_OR_PREV_START_DATE, navigation)
      }}
    />
  )
}

export const VisibleDidModal = ({ didForVisibility, setDidForVisibility }) => {

 const allIdentifiers = useSelector((state) => state.identifiers || [])
 const allContacts = useSelector((state) => state.contacts || [])

 return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={!!didForVisibility}
    >
      <View style={styles.centeredView}>
        <View style={styles.modalView}>
          <Text>
            { utility.didInfoLong(didForVisibility, allIdentifiers, allContacts) }
          </Text>
          <Text>(The DID is copied to the clipboard.)</Text>
          <TouchableHighlight
            style={styles.cancelButton}
            onPress={() => {
              setDidForVisibility(null)
            }}
          >
            <Text>Close</Text>
          </TouchableHighlight>
        </View>
      </View>
    </Modal>
  )
}


/**
 * Render each claim.
 *
 * source is any object or array
 * afterItemCss (optional) is CSS to add to add after each item
 */
export const YamlFormat = ({ source, afterItemCss }) => {

  const [didForVisibleModal, setDidForVisibleModal] = useState<string>(null)
  const [didsForLinkedModal, setDidsForLinkedModal] = useState<Array<string>>(null)
  const [claimIdForLinkedModal, setClaimIdForLinkedModal] = useState<string>(null)
  const [quickMessage, setQuickMessage] = useState<string>(null)

  const identifiers = useSelector((state) => state.identifiers || [])
  const allContacts = useSelector((state) => state.contacts || [])

  const copyToClipboard = (value) => {
    Clipboard.setString(value)
    setQuickMessage('Copied')
    setTimeout(() => { setQuickMessage(null) }, 1000)
  }

  /**
   * claimId (optional) is the ID for server lookup
   * visibleToDids (optional) is the object containing reference to visible DIDs
   */
  const objectToYamlReactRecur = (obj, claimId, visibleToDids) => {
    if (obj instanceof Object) {
      if (Array.isArray(obj)) {
        // array: loop through elements
        return (
          <View style={{ padding: 1 }}>
            {
              obj.map((item, index) =>
                <View key={ index } style={{ marginLeft: 5 }}>
                  <Text>- </Text>{ objectToYamlReactRecur(item, claimId || item.id, null) }
                </View>
              )
              /** This complained about being inside a ScrollView, and about nesting.
              <FlatList
                data={ obj }
                keyExtractor={(item, index) => "" + index}
                renderItem={(item, index) =>
                  <View style={{ marginLeft: 5 }}>
                    <Text>- </Text>{ objectToYamlReactRecur(item, claimId || item.id, null) }
                  </View>
                }
              />
              **/
            }
          </View>
        )
      } else {
        // regular object: loop through keys
        return (
          <View style={{ padding: 1 }}>
            {
              R.keys(obj).map((key, index) => {
                const newline = obj[key] instanceof Object ? "\n" : ""
                return (
                  <Text key={ index } style={{ marginLeft: 20 }}>
                    { key } : { newline }{ objectToYamlReactRecur(obj[key], claimId, obj[key + 'VisibleToDids']) }
                  </Text>
                )}
              )
            }
          </View>
        )
      }
    } else {
      const isVisibleDid = (typeof obj == 'string' && utility.isDid(obj) && !utility.isHiddenDid(obj))
      const style = (isVisibleDid || visibleToDids != null) ? { color: 'blue' } : {}
      // this is partly to avoid double-quotes
      const value = (typeof obj == 'string') ? obj : JSON.stringify(obj)
      const onPress =
        isVisibleDid
        ? () => { Clipboard.setString(value); setDidForVisibleModal(obj) }
        : (visibleToDids != null)
          ? () => { setDidsForLinkedModal(visibleToDids); setClaimIdForLinkedModal(claimId); }
          : () => { copyToClipboard(value) }
      return (
        <Text
          style={ style }
          onPress={ onPress }
          selectable={ true } // still can't copy/paste with this; why?
        >
          { value }
        </Text>
      )
    }
  }

  let finalSource = source
  if (source == null) {
    finalSource = []
  } else if (!Array.isArray(source)) {
    finalSource = [ source ]
  }
  return (
    <View>
      {
        finalSource.map((item: utility.EndorserRecord, index) =>
          <View key={ index } style={{ marginLeft: 10 }}>
            <Text>- </Text>{ objectToYamlReactRecur(item, item.id) }
            <View style={ afterItemCss || {} } />
          </View>
        )
      }

      <VisibleDidModal didForVisibility={didForVisibleModal} setDidForVisibility={setDidForVisibleModal} />

      <Modal
        animationType="slide"
        transparent={true}
        visible={!!didsForLinkedModal}
      >
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <Text>
              This person can be seen by the people connected to you, below.
              Ask one of them to give you more information about this claim:
            </Text>
            <Text style={{ padding: 10 }} selectable={true}>{ claimIdForLinkedModal }</Text>

            <Text>It's visible to these in your network:</Text>
            {
              didsForLinkedModal != null
              ? didsForLinkedModal.map((did) => {
                  const contact = R.find(con => con.did === did, allContacts)
                  return (
                    <Text key={ did } style={{ padding: 10 }} selectable={true}>
                      { utility.didInfoLong(did, identifiers, allContacts) }
                    </Text>
                  )
                })
              : <View/>
            }
            <TouchableHighlight
              style={styles.cancelButton}
              onPress={() => {
                setDidsForLinkedModal(null)
              }}
            >
              <Text>Close</Text>
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
  )
}

export const proceedToEditGive = (navigation, origClaim, fulfillsHandleId, fulfillsType) => {
  const giveClaim = {
    "@context": utility.SCHEMA_ORG_CONTEXT,
    "@type": "GiveAction",
  }
  giveClaim.fulfills = { "@type": fulfillsType, identifier: fulfillsHandleId }
  navigation.navigate('Create Credential', { incomingClaim: giveClaim })
}

export const proceedToEditOffer = (navigation, origClaim, handleId) => {
  const offerClaim = {
    '@context': utility.SCHEMA_ORG_CONTEXT,
    '@type': 'Offer',
    itemOffered: {
      '@type': 'CreativeWork',
      isPartOf: { '@type': origClaim['@type'], identifier: origClaim.identifier }
    },
  }
  if (!origClaim.identifier && handleId) {
    offerClaim.itemOffered.isPartOf.identifier = handleId
  }
  navigation.navigate('Create Credential', { incomingClaim: offerClaim })
}

export const proceedToEditPlan = (navigation, origClaim, handleId) => {
  const offerClaim = {
    '@context': utility.SCHEMA_ORG_CONTEXT,
    '@type': 'PlanAction',
    fulfills: { '@type': 'PlanAction', identifier: handleId },
  }
  navigation.navigate('Create Credential', { incomingClaim: offerClaim })
}

export const BookmarkModal = ({ takeBookmark, setTakeBookmark, record, deleteCallback, saveCallback }) => {

  const defaultBookmarkName = record.claim.name || ''
  const [bookmarkName, setBookmarkName] = useState<string>(defaultBookmarkName)

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={!!takeBookmark}
    >
      <View style={styles.centeredView}>
        <View style={styles.modalView}>
          <Text>Set bookmark for { record.handleId }</Text>
          <View>
            <Text>Name</Text>
            <TextInput
              value={bookmarkName}
              onChangeText={setBookmarkName}
              editable
              style={{borderWidth: 1}}
            />
          </View>
          <TouchableHighlight
            style={styles.saveButton}
            onPress={() => {
              utility.saveBookmark(dbConnection, record, bookmarkName)
                .then(() => { saveCallback() })
              setTakeBookmark(null)
            }}
          >
            <Text>Save</Text>
          </TouchableHighlight>
          <TouchableHighlight
            style={styles.cancelButton}
            onPress={() => {
              utility.deleteBookmark(dbConnection, record.handleId)
                .then(() => { deleteCallback() })
              setTakeBookmark(null)
            }}
          >
            <Text>Erase</Text>
          </TouchableHighlight>
          <TouchableHighlight
            style={styles.cancelButton}
            onPress={() => {
              setTakeBookmark(null)
            }}
          >
            <Text>Cancel</Text>
          </TouchableHighlight>
        </View>
      </View>
    </Modal>
  )
}

/**
 * Render each claim with links to take actions and expand details.
 *
 * source is any utility.EndorserRecord (required)
 * navigation is the standard navigation (required)
 * outstandingPerInvoice (optional) is for transaction lists
 * afterItemCss (optional) is CSS to add to add after each item
 */
export const RenderOneRecord = ({ source, navigation, outstandingPerInvoice, afterItemCss }) => {

  const outstandingInvoiceAmount = (offerMaybeWithIdOrRecipient) => {
    if (!outstandingPerInvoice) {
      return ""
    } else {
      if (outstandingPerInvoice[offerMaybeWithIdOrRecipient.identifier] > 0
          ||
          outstandingPerInvoice[offerMaybeWithIdOrRecipient.recipient?.identifier] > 0) {
        return "(Not All Paid)"
      } else if (finalOutstandingPerInvoice[offerMaybeWithIdOrRecipient.identifier] === 0
                 ||
                 finalOutstandingPerInvoice[offerMaybeWithIdOrRecipient.recipient?.identifier] === 0) {
        return "(All Paid)"
      } else if (offerMaybeWithIdOrRecipient.includesObject?.amountOfThisGood) {
        return "(Some Amount)"
      } else {
        return "(Not A Specific Amount)"
      }
    }
  }
  const finalOutstandingPerInvoice = outstandingPerInvoice || {}

  const [quickMessage, setQuickMessage] = useState<string>(null)
  const [showActions, setShowActions] = useState<boolean>(false)
  const [showDetails, setShowDetails] = useState<boolean>(false)
  const [showMore, setShowMore] = useState<boolean>(false)
  const [takeBookmark, setTakeBookmark] = useState<boolean>(false)

  const identifiers = useSelector((state) => state.identifiers || [])
  const contacts = useSelector((state) => state.contacts || [])

  const isUser = did => did === identifiers[0]?.did

  const summary = utility.claimSpecialDescription(source, identifiers, contacts)

  return (
    <View>

      <Text selectable={true}>{ summary }</Text>

      <View style={{ flexDirection: 'row' }}>
        <View style={{ marginLeft: 30 }}>
        {
          source.claim['@type'] === 'Offer'
          ?
            <Text>{ outstandingInvoiceAmount(source.claim) }</Text>
          :
            <View />
        }
        </View>

        <View style={{ marginLeft: 5 }}>
          {
            showMore
            ?
              <Icon
                name="chevron-up"
                onPress={() => setShowMore(prev => !prev)}
                style={{ color: 'blue', fontSize: 20, marginBottom: 10 }}
              />
            :
              <Text onPress={() => setShowMore(prev => !prev)}>
                <Icon name="chevron-right" style={{ color: 'blue', fontSize: 20 }} />
                ...
              </Text>
          }
        </View>
      </View>

      {
        showMore
        ?
          <View>
            {
              <View style={{ flexDirection: 'row' }}>

                { /** Accept a Contract **/

                  utility.isContract(source.claim) || utility.isContractAccept(source.claim)
                  ?
                    <View style={{ flexDirection: 'row', padding: 10 }}>
                      <Icon name="circle" style={{ marginLeft: 10, marginRight: 10 }} />
                      <Text
                        style={{ color: 'blue' }}
                        onPress={() => {
                          contract = utility.isContract(source.claim) ? source.claim : source.claim.object
                          return navigation.push(
                            utility.REVIEW_SIGN_SCREEN_NAV,
                            {
                              credentialSubject: utility.constructAccept(
                                identifiers[0],
                                utility.constructContract(contract.contractFormIpfsCid, contract.fields)
                              )
                            }
                          )
                        }}
                      >
                        Accept Contract
                      </Text>
                    </View>
                  :
                    <View />
                }

                { /** Give forward from another Give **/

                  source.claim['@type'] === 'GiveAction'
                    ?
                    <View style={{ flexDirection: 'row', padding: 10 }}>

                      <Icon name="circle" style={{ marginLeft: 10, marginRight: 10 }} />
                      <Pressable
                        style={{ padding: 10 }}
                        onPress={ () => {
                          proceedToEditGive(navigation, source.claim, source.handleId, "GiveAction")
                        }}
                      >
                        <Text style={{ color: "blue" }}>Record Contribution To</Text>
                      </Pressable>

                    </View>
                    :
                    <View />
                }

                { /** Give to fulfill an Offer **/

                  (source.claim['@type'] === 'Offer')
                  && (isUser(source.issuer)
                      || isUser(source.subject))
                  ?
                    <View style={{ flexDirection: 'row', padding: 10 }}>
                      <Icon name="circle" style={{ marginLeft: 10, marginRight: 10 }} />
                      <Pressable
                        onPress={ () => {
                          // record one each for itemOffered & includesObject if they exist
                          // and set the 'object' in each one containing those contents
                          const giveActionForm = {
                            "@context": "https://schema.org",
                            "@type": "GiveAction",
                            agent: { identifier: source.claim.offeredBy?.identifier },
                            recipient: source.claim.recipient,
                          }
                          if (source.handleId || source.claim.identifier) {
                            giveActionForm.fulfills = {
                              "@type": source.claim['@type'],
                              identifier: source.handleId || source.claim.identifier,
                            }
                          }
                          // There are potentially both an object & an item given.
                          let giveActions = []
                          if (source.claim.includesObject) {
                            const objectGive = R.clone(giveActionForm)
                            objectGive.object = R.clone(source.claim.includesObject)
                            if (source.claim.itemOffered?.isPartOf) {
                              objectGive.fulfills =
                                R.clone(source.claim.itemOffered.isPartOf)
                            }
                            giveActions = R.concat(giveActions, [objectGive])
                          }
                          if (source.claim.itemOffered) {
                            const itemGive = R.clone(giveActionForm)
                            itemGive.object = R.clone(source.claim.itemOffered)
                            giveActions = R.concat(giveActions, [itemGive])
                          }
                          navigation.push(utility.REVIEW_SIGN_SCREEN_NAV, {
                            credentialSubject: giveActions
                          })
                        }}
                      >
                        <Text style={{ color: "blue" }}>Record Delivery</Text>
                      </Pressable>
                    </View>
                  :
                    <View />
                }

                { /** Give to or Offer help with a Plan **/

                  source.claim['@type'] === 'PlanAction'
                  ?
                    <View style={{ flexDirection: 'row', padding: 10 }}>

                      <Icon name="circle" style={{ marginLeft: 10, marginRight: 10 }} />
                      <Pressable
                        style={{ padding: 10 }}
                        onPress={ () => {
                          proceedToEditGive(navigation, source.claim, source.handleId, "PlanAction")
                        }}
                      >
                        <Text style={{ color: "blue" }}>Record Contribution To</Text>
                      </Pressable>

                      <Icon name="circle" style={{ marginLeft: 10, marginRight: 10 }} />
                      <Pressable
                        style={{ padding: 10 }}
                        onPress={ () => {
                          proceedToEditOffer(navigation, source.claim, source.handleId)
                        }}
                      >
                        <Text style={{ color: "blue" }}>Offer Help With</Text>
                      </Pressable>

                      <Icon name="circle" style={{ marginLeft: 10, marginRight: 10 }} />
                      <Pressable
                        style={{ padding: 10 }}
                        onPress={ () => {
                          proceedToEditPlan(navigation, source.claim, source.handleId, "PlanAction")
                        }}
                      >
                        <Text style={{ color: "blue" }}>Create Plan To Fulfill</Text>
                      </Pressable>

                    </View>
                  :
                    <View />
                }

                { /** Agree to a... lmost anything **/

                  !isUser(source.issuer)
                  && source.claim['@type'] != 'AgreeAction' // you Agree to the original
                  && source.claim['@type'] != 'Contract' // you Accept
                  && source.claim['@type'] != 'Offer' // you Give
                  && source.claim['@type'] != 'PlanAction' // you Give or Offer
                  && source.claim['@type'] != 'Project' // you Give or Offer
                  ?
                    <View style={{ flexDirection: 'row', padding: 10 }}>
                      <Icon name="circle" style={{ marginLeft: 10, marginRight: 10 }} />
                      <Pressable
                        onPress={ () =>
                          navigation.push(utility.REVIEW_SIGN_SCREEN_NAV, {
                            credentialSubject: {
                              "@context": "https://schema.org",
                              "@type": "AgreeAction",
                              object:
                                utility.removeVisibleToDids(
                                  utility.removeSchemaContext(
                                    utility.addHandleAsIdIfMissing(
                                      source.claim, source.handleId
                                    )
                                  )
                                ),
                            }
                          })
                        }
                      >
                        <Text style={{ color: "blue" }}>Agree With</Text>
                      </Pressable>
                    </View>
                  :
                    <View />
                }

                { /** Check Cred **/

                  <View style={{ flexDirection: 'row', padding: 10 }}>
                    <Icon name="circle" style={{ marginLeft: 10, marginRight: 10 }} />
                    <Pressable
                      onPress={ () => navigation.navigate('Verify Credential', { wrappedClaim: source }) }
                    >
                      <Text style={{ color: "blue" }}>Check</Text>
                    </Pressable>
                  </View>
                }

                { /** Present Cred **/

                  utility.containsHiddenDid(source)
                  ?
                    <View />
                  :
                    <View style={{ flexDirection: 'row', padding: 10 }}>
                      <Icon name="circle" style={{ marginLeft: 10, marginRight: 10 }} />
                      <Pressable
                        onPress={ () =>
                          navigation.navigate('Present Credential', { fullClaim: source })
                        }
                      >
                        <Text style={{ color: "blue" }}>Present</Text>
                      </Pressable>
                    </View>
                }

                { /** Add/remove bookmark for a Plan or Project **/

                  source.claim['@type'] === 'PlanAction'
                  || source.claim['@type'] === 'Project'
                  ?
                  <View style={{ flexDirection: 'row', padding: 10 }}>

                    <Icon name="circle" style={{ marginLeft: 10, marginRight: 10 }} />
                    <Pressable
                      style={{ padding: 10 }}
                      onPress={ () => {
                        setTakeBookmark(true)
                      }}
                    >
                      <Text style={{ color: "blue" }}>Bookmark</Text>
                    </Pressable>

                  </View>
                  :
                  <View />
                }

              </View>
            }

            <View style={{ flexDirection: 'row', padding: 10 }}>
              <Text
                style={{ color: "blue" }}
                onPress={() => setShowDetails(prev => !prev )}
              >
                { showDetails ? "Hide" : "Show" } Details
              </Text>
            </View>

            {
              showDetails
              ? <YamlFormat
                  source={ source } navigation={ navigation }
                  afterItemCss={ afterItemCss } showActions={ showActions }
                />
              : <View />
            }

            <BookmarkModal
              record={source}
              setTakeBookmark={setTakeBookmark}
              takeBookmark={takeBookmark}
              deleteCallback={() => {
                setQuickMessage('Deleted')
                setTimeout(() => { setQuickMessage(null) }, 1000)
              }}
              saveCallback={() => {
                setQuickMessage('Saved')
                setTimeout(() => { setQuickMessage(null) }, 1000)
              }}
            />

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
        :
          <View />
      }

      <View style={styles.line} />
    </View>
  )
}

