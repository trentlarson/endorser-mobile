import { DateTime } from 'luxon'
import * as R from 'ramda'
import React, { useState } from 'react'
import { Alert, Button, Modal, Pressable, Text, TouchableHighlight, View } from 'react-native'
import Icon from 'react-native-vector-icons/FontAwesome'
import { useSelector } from 'react-redux'

import * as utility from './utility'
import { styles } from '../screens/style'
import { appStore } from "../veramo/appSlice";

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
            { utility.didInfo(didForVisibility, allIdentifiers, allContacts) }
          </Text>
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

  const identifiers = useSelector((state) => state.identifiers || [])
  const allContacts = useSelector((state) => state.contacts || [])

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
      const onPress =
        isVisibleDid
        ? () => { setDidForVisibleModal(obj) }
        : (visibleToDids != null)
          ? () => { setDidsForLinkedModal(visibleToDids); setClaimIdForLinkedModal(claimId); }
          : () => {}
      return (
        <Text
          style={ style }
          onPress={ onPress }
        >
          { JSON.stringify(obj) }
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
              This person can be seen by the people in your network, below.
              Ask one of them to give you more information about this claim:
            </Text>
            <Text style={{ padding: 10 }} selectable={true}>{ claimIdForLinkedModal }</Text>

            <Text>It's visible to these in network:</Text>
            {
              didsForLinkedModal != null
              ? didsForLinkedModal.map((did) => {
                  const contact = R.find(con => con.did === did, allContacts)
                  return (
                    <Text key={ did } style={{ padding: 10 }} selectable={true}>
                      { utility.didInfo(did, identifiers, allContacts) }
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

    </View>
  )
}

export const proceedToEditGive = (navigation, origClaim, handleId) => {
  const giveClaim = {
    "@context": utility.SCHEMA_ORG_CONTEXT,
    "@type": "GiveAction",
    fulfills: { "@type": "PlanAction", identifier: origClaim.identifier},
  }
  if (!giveClaim.identifier && handleId) {
    giveClaim.fulfills.identifier = handleId
  }
  navigation.navigate('Create Credential', { incomingClaim: giveClaim })
}

export const proceedToEditOffer = (navigation, origClaim, handleId) => {
  const offerClaim = {
    '@context': utility.SCHEMA_ORG_CONTEXT,
    '@type': 'Offer',
    itemOffered: {
      '@type': 'CreativeWork',
      isPartOf: { '@type': origClaim['@type'], identifier: origClaim.identifier }
    }
  }
  if (!origClaim.identifier && handleId) {
    offerClaim.itemOffered.isPartOf.identifier = handleId
  }
  navigation.navigate('Create Credential', { incomingClaim: offerClaim })
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

  const [showActions, setShowActions] = useState<boolean>(false)
  const [showDetails, setShowDetails] = useState<boolean>(false)
  const [showMore, setShowMore] = useState<boolean>(false)

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
                              objectGive.object.isPartOf =
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
                        <Text style={{ color: "blue" }}>Record Given</Text>
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
                          if (!source.handleId) {
                            Alert.alert("You cannot give to a project with no identifier.")
                          } else {
                            proceedToEditGive(navigation, source.claim, source.handleId)
                          }
                        }}
                      >
                        <Text style={{ color: "blue" }}>Record Given</Text>
                      </Pressable>

                      <Icon name="circle" style={{ marginLeft: 10, marginRight: 10 }} />
                      <Pressable
                        style={{ padding: 10 }}
                        onPress={ () => {
                          if (!source.handleId) {
                            Alert.alert("You cannot give to a project with no identifier.")
                          } else {
                            proceedToEditOffer(navigation, source.claim, source.handleId)
                          }
                        }}
                      >
                        <Text style={{ color: "blue" }}>Offer Help</Text>
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
                        <Text style={{ color: "blue" }}>Agree</Text>
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
                      <Text style={{ color: "blue" }}>Check it</Text>
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
                        <Text style={{ color: "blue" }}>Present it</Text>
                      </Pressable>
                    </View>
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
          </View>
        :
          <View />
      }

      <View style={styles.line} />
    </View>
  )
}

