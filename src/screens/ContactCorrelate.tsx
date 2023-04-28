import crypto from "crypto";
import * as R from "ramda";
import React, { useState } from "react";
import {
  ActivityIndicator, Alert,
  Button,
  Modal,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  TouchableHighlight,
  View
} from "react-native";
import { useSelector } from "react-redux";

import * as utility from "../utility/utility";
import { appSlice, appStore } from "../veramo/appSlice";
import { ContactSelectModal } from "./ContactSelect";
import { styles } from "./style";
import { Contact } from "../entity/contact";

export const RESULT_ALL_CLEARED = 'ALL_CACHES_CLEARED'
export const RESULT_NEED_APPROVAL = 'NEED_COUNTERPARTY_APPROVAL'
export const RESULT_NEED_BOTH_USER_DATA = 'NEED_BOTH_USER_DATA'
export const RESULT_NEED_COUNTERPARTY_DATA = 'NEED_COUNTERPARTY_DATA'
export const RESULT_NEED_THIS_USER_DATA = 'NEED_THIS_USER_DATA'
export const RESULT_ONE_CLEARED = 'ONE_CACHE_CLEARED'

const hashDidWithPass = (pass) => (did) => {
  const hash = crypto.createHash('sha256');
  hash.update(pass + did)
  return hash.digest('hex')
}

export function ContactCorrelateScreen({ navigation, route }) {

  const inputConfirmerIds = route.params?.confirmerIds

  const [counterpartyId, setCounterpartyId] = useState<string>('')
  //const [counterpartyId, setCounterpartyId] = useState<string>('did:ethr:0x000Ee5654b9742f6Fe18ea970e32b97ee2247B51')
  //const [counterpartyId, setCounterpartyId] = useState<string>('did:ethr:0x2224EA786b7C2A8E5782E16020F2f415Dce6bFa7')
  const [loading, setLoading] = useState<boolean>(false)
  /**
   * The value of match is:
   * - undefined before a match is tried and when waiting for the counterparty
   * - some string array of matching contact DIDs if there were matches
   */
  const [foundMatches, setFoundMatches] = useState<Array<string>>()
  const [matchError, setMatchError] = useState<string>('')
  const [matching, setMatching] = useState<boolean>(false)
  const [password, setPassword] = useState<string>('')
  const [selectCounterpartyFromContacts, setSelectCounterpartyFromContacts] = useState<boolean>(false)
  const [serverForcedOnlyOneMatch, setServerForcedOnlyOneMatch] = useState<boolean>(false)
  const [sentHashesToDids, setSentHashesToDids] = useState<Record<string, string>>({})
  const [showRecheckPopup, setShowRecheckPopup] = useState<boolean>(false)

  const allIdentifiers = useSelector((state) => state.identifiers || [])
  const allContacts = useSelector((state) => state.contacts || [])

  const confirmerIds =
    inputConfirmerIds
    ||
    // only taking 500 because of limit on server payload size
    R.take(500, allContacts)

  const checkMatch = (result, hashToDid) => {
    if (!result) {
      setFoundMatches(undefined)
      setMatchError('The server responded with an invalid match.')
    } else {
      const foundDids = result.map(hash => hashToDid[hash])
      setFoundMatches(foundDids)
      setMatchError('')
    }
  }

  const startMatching = async () => {

    if (!counterpartyId) {
      setMatchError('You must pick an identifier for your counterparty.')
      return
    }

    setLoading(true)
    setMatchError('')

    const endorserApiServer = appStore.getState().settings.apiServer
    const token = await utility.accessToken(allIdentifiers[0])
    const contactDids = confirmerIds.map(contact => contact.did)
    const payload = contactDids.map(hashDidWithPass(password))
    const hashToDid = R.zipObj(payload, contactDids)
    setSentHashesToDids(hashToDid)
    await fetch(
      endorserApiServer
      + '/api/userUtil/cacheContactList?counterparty='
      + encodeURIComponent(counterpartyId),
      {
        method: 'POST',
        headers: {
          "Content-Type": "application/json",
          "Uport-Push-Token": token,
      },
      body: JSON.stringify({ contactHashes: payload }),
    }).then(async response => {
      if (response.status == 201) {
        const resultData = await response.json()
        if (resultData.data == RESULT_NEED_COUNTERPARTY_DATA) {
          setFoundMatches(undefined)
          setMatching(true)
          setShowRecheckPopup(true)
        } else if (resultData.data?.matches) {
          // we get a match immediately if the counterparty sent first
          checkMatch(resultData.data.matches, hashToDid)
          setServerForcedOnlyOneMatch(resultData.data.onlyOneMatch)
          setMatching(false)
        } else {
          // should never get here
          setMatchError(
            "Got strange results from the server: "
            + JSON.stringify(resultData)
          )
        }
      } else {
        const result = await response.text()
        let error = { backendResult: result }
        try {
          const embeddedError = JSON.parse(result).error
          if (embeddedError) {
            error = embeddedError
          }
        } catch {
          // looks like the contents weren't JSON
        }
        throw error
      }
    })
    .catch(err => {
      const message =
        err.message
        ||
        'There was an error trying to start the matching process on the server.'
      setMatchError(message)
      appStore.dispatch(appSlice.actions.addLog({
        log: true,
        msg: "Got some server error starting the match process with "
          + counterpartyId + " - " + err.backendResult
      }))
    })
    setLoading(false)
  }

  const checkForMatch = async () => {
    setLoading(true)
    setMatchError('')

    const endorserApiServer = appStore.getState().settings.apiServer
    const token = await utility.accessToken(allIdentifiers[0])
    await fetch(
      endorserApiServer
      + '/api/userUtil/getContactMatch?counterparty='
      + encodeURIComponent(counterpartyId),
      {
        headers: {
          "Content-Type": "application/json",
          "Uport-Push-Token": token,
        },
      })
      .then(async response => {
        if (response.status == 200) {
          const resultData = await response.json()
          if (resultData.data == RESULT_NEED_BOTH_USER_DATA
              || resultData.data == RESULT_NEED_THIS_USER_DATA) {
            setFoundMatches(undefined)
            setMatchError(
              "You still need to start the matching process."
            )
          } else if (resultData.data == RESULT_NEED_COUNTERPARTY_DATA) {
            setFoundMatches(undefined)
            setShowRecheckPopup(true)
          } else if (resultData.data?.matches) {
            checkMatch(resultData.data.matches, sentHashesToDids)
            setServerForcedOnlyOneMatch(resultData.data.onlyOneMatch)
            setMatching(false)
          } else {
            // should never get here
            setMatchError(
              "Got strange results from the server: "
              + JSON.stringify(resultData)
            )
          }
        } else {
          const result = await response.text()
          let error = { backendResult: result }
          try {
            const embeddedError = JSON.parse(result).error
            if (embeddedError) {
              error = embeddedError
            }
          } catch {
            // looks like the contents weren't JSON
          }
          throw error
        }
      })
      .catch(err => {
        const message =
          err.message
          ||
          'There was an error trying to retrieve a match from the server.'
        setMatchError(message)
        appStore.dispatch(appSlice.actions.addLog({
          log: true,
          msg: "Got some server error retrieving the match with "
            + counterpartyId + " - " + JSON.stringify(err)
        }))
      })
    setLoading(false)
  }

  const requestMatchReset = async () => {
    setLoading(true)
    setMatchError('')

    const endorserApiServer = appStore.getState().settings.apiServer
    const token = await utility.accessToken(allIdentifiers[0])
    await fetch(
      endorserApiServer
      + '/api/userUtil/clearContactCaches?counterparty='
      + encodeURIComponent(counterpartyId),
      {
        method: 'DELETE',
        headers: {
          "Content-Type": "application/json",
          "Uport-Push-Token": token,
        },
      })
      .then(async response => {
        if (response.status == 200) {
          const resultData = await response.json()
          if (resultData.success == RESULT_ALL_CLEARED) {
            setMatching(false)
            Alert.alert("Done", "All data was cleared. You may begin again.")
          } else if (resultData.success == RESULT_ONE_CLEARED) {
            setMatching(false)
            Alert.alert("Done", "Your data was cleared. You may begin again.")
          } else if (resultData.success === RESULT_NEED_APPROVAL) {
            Alert.alert("Reset Requested", "Begin again once your counterparty has agreed.")
          } else {
            // should never get here
            setMatchError(
              "Got strange success results from the server: "
              + JSON.stringify(response.success)
            )
          }
        } else {
          const result = await response.text()
          let error = { backendResult: result }
          try {
            const embeddedError = JSON.parse(result).error
            if (embeddedError) {
              error = embeddedError
            }
          } catch {
            // looks like the contents weren't JSON
          }
          throw error
        }
      })
      .catch(err => {
        const message =
          err.message
          ||
          'There was an error trying to reset your request on the server.'
        setMatchError(message)
        appStore.dispatch(appSlice.actions.addLog({
          log: true,
          msg: "Got some server error clearing the contact match caches with "
            + counterpartyId + " - " + JSON.stringify(err)
        }))
      })
    setLoading(false)
  }

  const foundMessage = (matchResult: Contact) => {
    return (
      matchResult === undefined
      ?
        <View />
      : matchResult.length === 0
        ?
          <Text>
            Result: No match was found in that set.
            (Or: the passwords may be different.)
          </Text>
        : // matchResult.length > 0
          <View>
            <Text style={{ textAlign: 'center' }}>Result: Matches were found!</Text>
            {
              matchResult.map((match, index) => {
                return (
                  <View key={ index }>
                    <Text style={{ textAlign: 'center' }}>
                      { utility.didInfo(match, allIdentifiers, allContacts) }
                    </Text>
                  </View>
                )
              })
            }
          </View>
    )
  }

  return (
    <SafeAreaView>
      <ScrollView style={{ padding: 10 }}>
        <Text style={{ fontSize: 30, fontWeight: 'bold' }}>Find a Common Contact</Text>

        <View style={{ marginBottom: 20 }}>
          <Text>
            This will privately test whether you and your counterparty have a
            contact in common.
          </Text>

          <Text style={{ marginTop: 10 }}>
            You and that person must run this process and complete it within
            one minute.
          </Text>

          <Text style={{ marginLeft: 10, marginTop: 10 }}>
            Each time you run it together, you may get a different matching
            contact. You can run it as many times as you wish.
          </Text>

          <Text style={{ marginLeft: 10, marginTop: 10 }}>
            Nobody else will see all your contacts; they are
            hidden from your counterparty by an intermediate server, and they are
            hidden from the server and the rest of the world by the password that
            you and the counterparty share.
          </Text>

          <Text style={{ marginLeft: 10, marginTop: 10 }}>
            Note that { confirmerIds.length } contacts will be tested.
          </Text>
        </View>

        <View style={{ marginTop: 20 }} />
        <Text>Enter the counterparty's ID.</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
          <TextInput
            style={{ borderWidth: 1, width: 200 }}
            onChangeText={setCounterpartyId}
            autoCapitalize={'none'}
            autoCorrect={false}
          >
            { counterpartyId }
          </TextInput>
          <Button
            title="Pick from Contacts"
            onPress={() => setSelectCounterpartyFromContacts(true)}
          />
        </View>

        <View style={{ marginTop: 20 }} />
        <Text>
          Enter a password, anything that you and the counterparty agree on, just for this reveal.
          You don't need to remember it, just share it privately with the other person this one time.
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
          <Text style={{ marginRight: 10 }}>Password</Text>
          <TextInput
            style={{ borderWidth: 1, width: 100 }}
            onChangeText={setPassword}
            autoCapitalize={'none'}
            autoCorrect={false}
          >
            { password }
          </TextInput>
        </View>

        <View style={{ marginTop: 20 }} />
        {
          loading
          ?
            <ActivityIndicator color="#00ff00" />
          :
            <Text>
              Status:
              &nbsp;
              {
                foundMatches
                ? "Finished matching."
                : matching ? "Started matching." : "Ready to start."
              }
            </Text>
        }

        { foundMessage(foundMatches) }

        {
          serverForcedOnlyOneMatch
            ? <Text style={{ textAlign: 'center' }}>
              Note: the server only returned one match because someone chose that option.
            </Text>
            : <View />
        }

        <Text style={{ color: 'red', textAlign: 'center' }}>{ matchError } </Text>

        <Button
          title="Start matching process together"
          onPress={() => {
            if (counterpartyId) {
              startMatching(); setShowRecheckPopup(true)
            } else {
              Alert.alert('You must set the ID of the counterparty.')
            }
          }}
        />

        <Button
          title="Recheck results"
          onPress={() => { checkForMatch(true); setShowRecheckPopup(true) }}
          style={{ marginTop: 10 }}
        />

        <Button
          title="Clear results. (Counterparty must agree.)"
          onPress={() => {
            requestMatchReset()
          }}
          style={{ marginTop: 10 }}
        />




        <Modal
          animationType="slide"
          transparent={true}
          visible={!!showRecheckPopup}
        >
          <View style={styles.centeredView}>
            <View style={styles.modalView}>

              {
              loading
              ? <ActivityIndicator color="#00ff00" />
              : foundMatches
                ?
                  foundMessage(foundMatches)
                :
                  matching
                  ?
                    <View>
                      <Text>Data is still needed.</Text>
                    </View>
                  :
                    <Text>Process hasn't started.</Text>
              }

              <View style={{ marginTop: 20 }} />
              <TouchableHighlight
                style={styles.saveButton}
                onPress={() => checkForMatch()}
              >
                <Text>Recheck</Text>
              </TouchableHighlight>

              <View style={{ marginTop: 20 }} />
              <TouchableHighlight
                style={styles.cancelButton}
                onPress={() => setShowRecheckPopup(false)}
              >
                <Text>Close</Text>
              </TouchableHighlight>
            </View>
          </View>
        </Modal>

        {
        selectCounterpartyFromContacts
        ?
          <ContactSelectModal
            cancel={ () => { setSelectCounterpartyFromContacts(false) } }
            proceed={ (did) => {
              setCounterpartyId(did)
              setSelectCounterpartyFromContacts(false)
            }}
          />
        :
          <View/>
        }

      </ScrollView>
    </SafeAreaView>
  )
}
