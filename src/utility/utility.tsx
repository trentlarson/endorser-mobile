import { DateTime } from 'luxon'
import * as R from 'ramda'
import React, { useState } from 'react'
import { Button, Modal, Pressable, Text, TouchableHighlight, View } from 'react-native'
import Icon from 'react-native-vector-icons/FontAwesome'
import { useSelector } from 'react-redux'

import * as utility from './utility'
import { styles } from '../screens/style'

function setClaimToAttendance(id: IIdentifier | undefined, startTime: string, navigation) {
  const claimObj = utility.bvcClaim(id ? id.did : 'UNKNOWN', startTime)
  navigation.push(utility.REVIEW_SIGN_SCREEN_NAV, { credentialSubject: claimObj })
}

export const BVCButton = ({ identifier, navigation, description }) => {

  const todayIsSaturday = DateTime.local().weekday === 6

  return (
    <Button
      title={'Attended ' + description + ' ' + (todayIsSaturday ? 'Today' : 'Last Time')}
      onPress={() => {
        let currentOrPreviousSat = DateTime.local()
        if (currentOrPreviousSat.weekday < 6) {
          // it's not Saturday or Sunday, so move back one week before setting to the Saturday
          currentOrPreviousSat = currentOrPreviousSat.minus({week:1})
        }
        const eventStartDateObj = currentOrPreviousSat.set({weekday:6}).set({hour:9}).startOf("hour")
        // Hack, but the full ISO pushes the length to 340 which crashes verifyJWT!  Crazy!
        const TODAY_OR_PREV_START_DATE = eventStartDateObj.toISO({suppressMilliseconds:true})
        setClaimToAttendance(identifier, TODAY_OR_PREV_START_DATE, navigation)
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
          outstandingPerInvoice[
            offerMaybeWithIdOrRecipient.recipient && offerMaybeWithIdOrRecipient.recipient.identifier
          ] > 0) {
        return "(Not Fully Paid)"
      } else if (finalOutstandingPerInvoice[offerMaybeWithIdOrRecipient.identifier] === 0
                 ||
                 finalOutstandingPerInvoice[
                   offerMaybeWithIdOrRecipient.recipient && offerMaybeWithIdOrRecipient.recipient.identifier
                 ] === 0) {
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

  const isUser = did => did === identifiers[0].did

  const removeSchemaContext = obj => obj['@context'] === 'https://schema.org' ? R.omit(['@context'], obj) : obj

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
            source.claim['@type'] === 'GiveAction'
            ?
              <Text>(Paid)</Text>
            :
              <View />
        }
        </View>

        <View style={{ marginLeft: 5 }}>
          {
            showMore
            ?
              <Icon
                name="chevron-down"
                onPress={() => setShowMore(prev => !prev)}
                style={{ color: 'blue', fontSize: 20, marginBottom: 10 }}
              />
            :
              <Text onPress={() => setShowMore(prev => !prev)}>
                <Icon name="chevron-right" style={{ color: 'blue' }} />
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

                  isUser(source.issuer)
                  && (source.claim['@type'] === 'Offer')
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
                            agent: { identifier: identifiers[0].did },
                            recipient: source.claim.recipient,
                          }
                          if (source.claim.identifier) {
                            giveActionForm.fulfills = {
                              "@type": source.claim['@type'],
                              identifier: source.claim.identifier,
                            }
                          }
                          const items = [source.claim.includesObject, source.claim.itemOffered]
                          const offered = R.filter(i => i != null, items)
                          const giveActions = R.map(
                            item => R.set(R.lensProp('object'), item, R.clone(giveActionForm)),
                            offered
                          )
                          navigation.push(utility.REVIEW_SIGN_SCREEN_NAV, {
                            credentialSubject: giveActions
                          })
                        }}
                      >
                        <Text style={{ color: "blue" }}>Mark as given</Text>
                      </Pressable>
                    </View>
                  :
                    <View />
                }

                { /** Take a Give **/

                  !isUser(source.issuer)
                  && (source.claim['@type'] === 'LoanOrCredit'
                     || source.claim['@type'] === 'GiveAction')
                  ?
                    <View style={{ flexDirection: 'row', padding: 10 }}>
                      <Icon name="circle" style={{ marginLeft: 10, marginRight: 10 }} />
                      <Pressable
                        style={{ padding: 10 }}
                        onPress={ () =>
                          navigation.push(utility.REVIEW_SIGN_SCREEN_NAV, {
                            credentialSubject: {
                              "@context": "https://schema.org",
                              "@type": "TakeAction",
                              agent: { identifier: identifiers[0].did },
                              object: removeSchemaContext(source.claim),
                            }
                          })
                        }
                      >
                        <Text style={{ color: "blue" }}>Take</Text>
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
                              object: removeSchemaContext(source.claim),
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

