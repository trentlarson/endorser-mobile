import Debug from 'debug'
import * as R from 'ramda'
import React, { useEffect, useState } from 'react'
import { Button, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native'
import { CheckBox } from "react-native-elements"

import { onboarding } from '../data/onboarding'
import * as utility from '../utility/utility'
import { appSlice, appStore, DEFAULT_ENDORSER_API_SERVER, DEFAULT_ENDORSER_VIEW_SERVER } from '../veramo/appSlice'

export function EditCredentialScreen({ navigation, route }) {

  let { credentialSubject, privateFields } = route.params

  const id0 = appStore.getState().identifiers && appStore.getState().identifiers[0]

  let credSubjArray = []
  if (credentialSubject != null) {
    credSubjArray = Array.isArray(credentialSubject) ? credentialSubject : [ credentialSubject ]
  }
  let privateFieldsArray = []
  if (privateFields != null) {
    privateFieldsArray = Array.isArray(privateFields) ? privateFields : [ privateFields ]
  }

  const [claimArrayStr, setClaimArrayStr] = useState<string>(JSON.stringify(credSubjArray))
  const [claimJsonError, setClaimJsonError] = useState<string>(null)

  const [HAS_MNEMONIC, SET_HAS_MNEMONIC] = useState<boolean>(false)
  // fields are objects with keys & values
  const [PRIVATE_FIELDS, SET_PRIVATE_FIELDS] = useState<Array<any>>(privateFieldsArray)

  function formatClaimJson(claimArray): string {
    return JSON.stringify(claimArray, null, 2)
  }

  function formatClaimJsonString(claimArrayString): string {
    if (claimArrayString) {
      try {
        return formatClaimJson(JSON.parse(claimArrayString))
      } catch (err) {
        return claimArrayString
      }
    } else {
      return ''
    }
  }

  function findContractWithCid(cid: string) {
    return R.find(def => def.templateIpfsCid === cid, R.values(onboarding))
  }

  function changeCurlyQuotes(text) {
    setClaimArrayStr(text.replace(/”/g, "\"").replace(/“/g, "\""))
  }
  function hasCurlyQuotes(text) {
    return text && (text.match(/”/) || text.match(/“/))
  }

  // Check for existing identifers on load and set them to state
  useEffect(() => {
    const getIdentifier = async () => {
      let settings = appStore.getState().settings
      if (settings && (settings.mnemEncrBase64 || settings.mnemonic)) {
        SET_HAS_MNEMONIC(true)
      }
    }
    getIdentifier()
  }, [])

  return (
    <SafeAreaView>
      <ScrollView>
        <View style={{ padding: 20 }}>
          { id0 ? (
            <View>
              <Text style={{ fontSize: 30, fontWeight: 'bold', marginBottom: 10 }}>
                Review
                {
                  (appStore.getState().settings.apiServer !== DEFAULT_ENDORSER_API_SERVER
                   || appStore.getState().viewServer !== DEFAULT_ENDORSER_VIEW_SERVER)
                   ? " - Custom Servers"
                   : ""
                }
              </Text>
              <View>
                <View>
                  <View style={{ padding: 5 }} />
                  {
                    (claimJsonError && claimJsonError.length > 0)
                    ?
                      <Text style={{ textAlign: 'center' }}>Sign{'\n'}(... ready after fixing the formatting error.)</Text>
                    :
                      <View>
                        <Button
                          title={'Review & Sign'}
                          onPress={() =>
                            navigation.push(utility.REVIEW_SIGN_SCREEN_NAV, {
                              credentialSubject: JSON.parse(claimArrayStr),
                              privateFields: PRIVATE_FIELDS
                            }
                          )}
                        />
                      </View>
                  }

                  <Text style={{ marginTop: 75, marginBottom: 5, fontSize: 20, fontWeight: 'bold' }}>Technical Details</Text>
                  <Text style={{ fontSize: 11 }}>Signing As:</Text>
                  <Text style={{ fontSize: 11 }}>{id0.did}</Text>
                  { !HAS_MNEMONIC ? (
                    <Text style={{ padding: 10, color: 'red' }}>There is no backup available for this ID. We recommend you generate a different identifier and do not keep using this one. (See Help.)</Text>
                  ) : (
                     <Text/>
                  )}

                  <Text>Shared Data</Text>
                  <TextInput
                    multiline={true}
                    style={{ borderWidth: 1, height: 300 }}
                    onChangeText={setClaimArrayStr}
                    autoCorrect={false}
                  >
                    { formatClaimJsonString(claimArrayStr) }
                  </TextInput>
                  <Text style={{ color: 'red' }}>{ claimJsonError }</Text>
                  {
                    hasCurlyQuotes(claimArrayStr)
                    ?
                      <Button
                        title={'Change Curly Quotes To Regular Quotes'}
                        onPress={() => changeCurlyQuotes(claimArrayStr)}
                      />
                    :
                      <View/>
                  }

                  <Text>Private Fields (cannot be edited)</Text>
                  <TextInput
                    multiline={true}
                    style={{ borderWidth: 1 }}
                    editable={false}
                  >
                    { formatClaimJson(PRIVATE_FIELDS) }
                  </TextInput>
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
}
