import { DateTime } from 'luxon'
import * as R from 'ramda'
import React, { useState } from 'react'
import { Button, Modal, Text, TouchableHighlight, View } from 'react-native'
import { useSelector } from 'react-redux'

import * as utility from './utility'
import { styles } from '../screens/style'

function setClaimToAttendance(id: IIdentifier | undefined, startTime: string, navigation) {
  const claimObj = utility.bvcClaim(id ? id.did : 'UNKNOWN', startTime)
  navigation.navigate('Review to Sign Credential', { credentialSubject: claimObj })
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
            { utility.didInContext(didForVisibility, allIdentifiers, allContacts) }
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
 * Render each claim with links to take actions.
 *
 * source is any object or array
 * navigation (optional) is the navigation object (used to provide links to verify cred, etc)
 * afterItemCss (optional) is CSS to add to add after each item
 */
export const YamlFormat = ({ source, navigation, afterItemCss }) => {

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
  let hideActions = false
  if (!navigation) {
    hideActions = true
  }
  if (source == null) {
    finalSource = []
  } else if (!Array.isArray(source)) {
    // it's a single item, so we'll hide the actions
    finalSource = [ source ]
    hideActions = true
  }
  return (
    <View>
      {
        finalSource.map((item: utility.EndorserRecord, index) =>
          <View key={ index } style={{ marginLeft: 5 }}>
            {
              hideActions
              ?
                <View />
              :
                <View>
                  <Text
                    style={{ color: 'blue' }}
                    onPress={() => navigation.navigate(
                      'Verify Credential',
                      { wrappedClaim: item }
                    )}
                  >
                    Check
                  </Text>
                  {
                    item.claimType === 'Contract'
                    || item.claim && item.claim['@type'] === 'Contract'
                    || (item.claimType === 'AcceptAction'
                        && item.claim.object && item.claim.object['@type'] === 'Contract'
                    )
                    ?
                      <Text
                        style={{ color: 'blue' }}
                        onPress={() => navigation.navigate(
                          'Review to Sign Credential',
                          { credentialSubject: utility.constructContract(item.claim.contractFormIpfsCid, item.claim.fields) }
                        )}
                      >
                        Accept Contract
                      </Text>
                    :
                      <View />
                  }
                  {
                    item.claimType === 'DonateAction'
                    || item.claim && item.claim['@type'] === 'DonateAction'
                    ?
                      <Text
                        style={{ color: 'blue' }}
                        onPress={() => navigation.navigate(
                          'Review to Sign Credential',
                          { credentialSubject:
                            { '@context': 'https://schema.org',
                              '@type': 'GiveAction',
                              agent: item.claim.agent,
                              recipient: item.claim.recipient,
                              identifier: item.claim.identifier,
                              price: item.claim.price,
                              priceCurrency: item.claim.priceCurrency,
                            }
                          }
                        )}
                      >
                        Record as Paid
                      </Text>
                    :
                      <View />
                  }
                  {
                    item.claimType !== 'AgreeAction'
                    ?
                      <Text
                        style={{ color: 'blue' }}
                        onPress={() => navigation.navigate(
                          'Review to Sign Credential',
                          { credentialSubject:
                            { '@context': 'https://schema.org',
                              '@type': 'AgreeAction',
                              object: item.claim,
                            }
                          }
                        )}
                      >
                        Agree / Confirm
                      </Text>
                    :
                      <View />
                  }
                </View>
            }

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
                      { utility.didInContext(did, identifiers, allContacts) }
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
