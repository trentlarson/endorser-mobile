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

export const RESULT_NEED_DATA = 'NEED_COUNTERPARTY_DATA'
export const RESULT_NO_MATCH = 'NO_MATCH'

const hashDidWithPass = (pass) => (did) => {
  const hash = crypto.createHash('sha256');
  hash.update(pass + did)
  return hash.digest('hex')
}

export function ContactCorrelateScreen({ navigation, route }) {

  const inputConfirmerIds = route.params?.confirmerIds

  const [counterpartyId, setCounterpartyId] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  /**
   * The value of match is:
   * - undefined before a match is tried and when waiting for the counterparty
   * - some string array of matching contact DIDs if there were matches
   */
  const [foundMatches, setFoundMatches] = useState<Array<string>>(undefined)
  const [waitingForCounterparty, setWaitingForCounterparty] = useState<boolean>(false)
  const [matchError, setMatchError] = useState<string>('')
  const [matching, setMatching] = useState<boolean>(false)
  const [password, setPassword] = useState<string>('')
  const [selectCounterpartyFromContacts, setSelectCounterpartyFromContacts] = useState<boolean>(false)
  const [serverForcedOnlyOneMatch, setServerForcedOnlyOneMatch] = useState<boolean>(false)
  const [sentHashesToDids, setSentHashesToDids] = useState<Record<string, string>>({})

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
      + '/api/util/cacheContactList?counterparty='
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
        if (resultData.data == RESULT_NEED_DATA) {
          setFoundMatches(undefined)
          setMatching(true)
          setWaitingForCounterparty(true)
        } else if (resultData.data?.matches) {
          // we get a match immediately if the counterparty sent first
          checkMatch(resultData.data.matches, hashToDid)
          setServerForcedOnlyOneMatch(resultData.data.onlyOneMatch)
          setMatching(false)
          setWaitingForCounterparty(false)
        } else {
          // should never get here
          setMatchError(
            "Got strange results from the server: "
            + JSON.stringify(resultData)
          )
        }
      } else {
        const result = await response.text()
        const error = { backendResult: result }
        try {
          const embeddedMessage = JSON.stringify(result).error?.message
          error.error = { message: embeddedMessage }
        } catch {
          // looks like the contents weren't JSON
        }
        throw error
      }
    })
    .catch(err => {
      let message = 'There was an error from the server trying to start the matching process.'
      if (err.error?.message) {
        message = message + ' ' + err.error.message
      }
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
      + '/api/util/getContactMatch?counterparty='
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
          if (resultData.data == RESULT_NEED_DATA) {
            setFoundMatches(undefined)
            setMatching(true)
            setWaitingForCounterparty(true)
          } else if (resultData.data?.matches) {
            checkMatch(resultData.data.matches, sentHashesToDids)
            setServerForcedOnlyOneMatch(resultData.data.onlyOneMatch)
            setMatching(false)
            setWaitingForCounterparty(false)
          } else {
            // should never get here
            setMatchError(
              "Got strange results from the server: "
              + JSON.stringify(resultData)
            )
          }
        } else {
          const result = await response.text()
          const error = { backendResult: result }
          try {
            const embeddedMessage = JSON.stringify(result).error?.message
            error.error = { message: embeddedMessage }
          } catch {
            // looks like the contents weren't JSON
          }
          throw error
        }
      })
      .catch(err => {
        let message = 'There was an error from the server trying to retrieve a match.'
        if (err.error?.message) {
          message = message + ' ' + err.error.message
        }
        setMatchError(message)
        appStore.dispatch(appSlice.actions.addLog({
          log: true,
          msg: "Got some server error retrieving the match with "
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
            (Or: the passwords are different.)
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
        <Button
          title="Begin Search Process Together"
          onPress={() => {
            if (counterpartyId) {
              startMatching()
            } else {
              Alert.alert('You must set the ID of the counterparty.')
            }
          }}
        />

        {
          waitingForCounterparty
          ?
            <Button
              title="Recheck Process Already Begun"
              onPress={() => { setMatching(true) }}
              style={{ marginTop: 20 }}
            />
          :
            <View />
        }

        {
          loading
          ? <ActivityIndicator color="#00ff00" />
          : <View />
        }

        <Text style={{ color: 'red', textAlign: 'center' }}>{ matchError } </Text>

        { foundMessage(foundMatches) }

        {
          serverForcedOnlyOneMatch
          ? <Text style={{ textAlign: 'center' }}>
              Note: the server only returned one match because someone chose that option.
            </Text>
          : <View />
        }




        <Modal
          animationType="slide"
          transparent={true}
          visible={!!matching}
        >
          <View style={styles.centeredView}>
            <View style={styles.modalView}>

              <Text>The process has started.</Text>

              {
              loading
              ? <ActivityIndicator color="#00ff00" />
              : foundMatches === undefined
                ?
                  <View>
                    <Text>Your counterparty hasn't started their process.</Text>
                    <Button
                      title="Recheck"
                      onPress={() => {
                        checkForMatch()
                      }}
                    />
                  </View>
                :
                  foundMessage(foundMatches)
              }

              <TouchableHighlight
                style={styles.cancelButton}
                onPress={() => setMatching(false)}
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
