import Debug from 'debug'
import React, { useEffect, useState } from 'react'
import { Button, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native'
import { CheckBox } from "react-native-elements"

import * as utility from '../utility/utility'
import { appSlice, appStore, DEFAULT_ENDORSER_API_SERVER, DEFAULT_ENDORSER_VIEW_SERVER } from '../veramo/appSlice'

const debug = Debug('endorser-mobile:review-credential')

export function ReviewToSignCredentialScreen({ navigation, route }) {

  let { credentialSubject, scanned, substitute } = route.params

  let credSubjArray = []
  if (credentialSubject != null) {
    credSubjArray = Array.isArray(credentialSubject) ? credentialSubject : [ credentialSubject ]
  } else if (scanned != null) {
    let scannedCred = JSON.parse(scanned)
    credSubjArray = Array.isArray(scannedCred) ? scannedCred : [ scannedCred ]
  }

  const [claimJsonError, setClaimJsonError] = useState<string>(null)
  const [claimStr, setClaimStr] = useState<string>(JSON.stringify(credSubjArray))
  const [hasMnemonic, setHasMnemonic] = useState<boolean>(false)
  const [id0, setId0] = useState<Identifier>()
  const [sendToEndorser, setSendToEndorser] = useState<boolean>(true)

  function formatClaimJson(claimString) {
    if (claimString) {
      try {
        return JSON.stringify(JSON.parse(claimString), null, 2)
      } catch (err) {
        return claimString
      }
    } else {
      return ''
    }
  }

  function changeCurlyQuotes() {
    setClaimStr(claimStr.replace(/”/g, "\"").replace(/“/g, "\""))
  }
  function hasCurlyQuotes() {
    return claimStr && (claimStr.match(/”/) || claimStr.match(/“/))
  }

  // Check for existing identifers on load and set them to state
  useEffect(() => {
    const getIdentifier = async () => {
      const defaultId = appStore.getState().identifiers && appStore.getState().identifiers[0]
      setId0(defaultId)

      let settings = appStore.getState().settings
      if (settings && (settings.mnemEncrBase64 || settings.mnemonic)) {
        setHasMnemonic(true)
      }
    }
    getIdentifier()
  }, [])

  useEffect(() => {
    if (claimStr == null || claimStr.trim() == '') {
      setClaimJsonError('The claim is empty.')
    } else {

      try {
        JSON.stringify(JSON.parse(claimStr), null, 2)
        setClaimJsonError('')
      } catch (err) {
        setClaimJsonError('The claim is not formatted correctly. ' + err)
      }

      if (substitute) {
        let newClaimStr = claimStr
        if (id0) {
          newClaimStr = claimStr.replace(utility.REPLACE_USER_DID_STRING, id0.did)
        }
        setClaimStr(newClaimStr)
      }

    }
  }, [claimStr, id0])

  return (
    <SafeAreaView>
      <ScrollView>
        <View style={{ padding: 20 }}>
          { id0 ? (
            <View>
              <Text style={{ fontSize: 30, fontWeight: 'bold', marginBottom: 10 }}>
                Review
                {
                  (appStore.getState().apiServer !== DEFAULT_ENDORSER_API_SERVER
                   || appStore.getState().viewServer !== DEFAULT_ENDORSER_VIEW_SERVER)
                   ? " - Custom Servers"
                   : ""
                }
              </Text>
              <View>
                {
                  claimStr ? (
                    <View>
                      <Text>Hit 'sign' if the information below is good.</Text>
                    </View>
                  ) : ( /* !claimStr */
                    <Text>No claim found.  Go back and try again.</Text>
                  )
                }

                <View>
                  <View style={{ padding: 5 }} />
                  {
                    (claimJsonError && claimJsonError.length > 0)
                    ?
                      <Text style={{ textAlign: 'center' }}>Sign{'\n'}(... after fixing the formatting error.)</Text>
                    :
                      <View>
                        <Button
                          title={'Sign'}
                          onPress={() => navigation.navigate(
                            'Signature Results',
                            {
                              identifier: id0,
                              credentialSubjects: JSON.parse(claimStr),
                              sendToEndorser,
                            }
                          )}
                        />
                        <CheckBox
                          title='Store Your Signature on a Server for Selective Disclosure in the Future'
                          checked={sendToEndorser}
                          onPress={() => setSendToEndorser(!sendToEndorser)}
                        />
                      </View>
                  }

                  <Text style={{ marginTop: 75, marginBottom: 5 }}>Details</Text>
                  <Text style={{ fontSize: 11 }}>Signing As:</Text>
                  <Text style={{ fontSize: 11 }}>{id0.did}</Text>
                  { !hasMnemonic ? (
                    <Text style={{ padding: 10, color: 'red' }}>There is no backup available for this ID. We recommend you generate a different identifier and do not keep using this one. (See Help.)</Text>
                  ) : (
                     <Text/>
                  )}

                  <TextInput
                    multiline={true}
                    style={{ borderWidth: 1, height: 300 }}
                    onChangeText={setClaimStr}
                    autoCorrect={false}
                  >
                    { formatClaimJson(claimStr) }
                  </TextInput>
                  <Text style={{ color: 'red' }}>{ claimJsonError }</Text>
                  {
                    hasCurlyQuotes()
                    ?
                      <Button
                        title={'Change Curly Quotes To Regular Quotes'}
                        onPress={changeCurlyQuotes}
                      />
                    :
                      <View/>
                  }
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
