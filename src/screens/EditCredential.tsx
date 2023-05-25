import Debug from 'debug'
import * as R from 'ramda'
import React, { useEffect, useState } from 'react'
import { Button, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native'
import { CheckBox } from "react-native-elements"

import { onboarding } from '../data/onboarding'
import * as utility from '../utility/utility'
import { appSlice, appStore, DEFAULT_ENDORSER_API_SERVER, DEFAULT_ENDORSER_VIEW_SERVER } from '../veramo/appSlice'

export function EditCredentialScreen({ navigation, route }) {

  let { claims, privateFields } = route.params

  let credSubjArray = []
  if (claims != null) {
    credSubjArray = Array.isArray(claims) ? claims : [ claims ]
  }
  let PRIVATE_FIELDS = []
  if (privateFields != null) {
    PRIVATE_FIELDS = Array.isArray(privateFields) ? privateFields : [ privateFields ]
  }

  const [claimArrayStr, setClaimArrayStr] = useState<string>(JSON.stringify(credSubjArray))
  const [claimJsonError, setClaimJsonError] = useState<string>(null)

  function formatClaimJson(claimArray): string {
    return JSON.stringify(claimArray, null, 2)
  }

  function formatClaimJsonString(claimArrayString): string {
    if (!claimArrayString) {
      return ''
    } else {
      try {
        const result = formatClaimJson(JSON.parse(claimArrayString))
        if (claimJsonError) {
          setClaimJsonError('')
        }
        return result
      } catch (err) {
        const errStr = '' + err
        if (claimJsonError !== errStr) {
          setClaimJsonError(errStr)
        }
        return claimArrayString
      }
    }
  }

  function changeCurlyQuotes(text) {
    setClaimArrayStr(text.replace(/”/g, "\"").replace(/“/g, "\""))
  }
  function hasCurlyQuotes(text) {
    return text && (text.match(/”/) || text.match(/“/))
  }

  return (
    <SafeAreaView>
      <ScrollView>
        <View style={{ padding: 20 }}>
          <View>
            <View>
              <View>
                <View style={{ padding: 5 }} />
                {
                  (claimJsonError && claimJsonError.length > 0)
                  ?
                    <Text style={{ textAlign: 'center' }}>Sign{'\n'}(... after fixing the formatting error.)</Text>
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

                <Text style={{ marginTop: 20, marginBottom: 5, fontSize: 20, fontWeight: 'bold' }}>Technical Details</Text>

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

                <Text>Private Data (must be edited in the original form)</Text>
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
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
