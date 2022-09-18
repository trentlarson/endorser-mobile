import Debug from 'debug'
import * as R from 'ramda'
import React, { useEffect, useState } from 'react'
import { Button, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native'
import { CheckBox } from "react-native-elements"

import * as utility from '../utility/utility'
import { YamlFormat } from '../utility/utility.tsx'
import { appSlice, appStore, DEFAULT_ENDORSER_API_SERVER, DEFAULT_ENDORSER_VIEW_SERVER } from '../veramo/appSlice'

const debug = Debug('endorser-mobile:review-credential')

export function ReviewToSignCredentialScreen({ navigation, route }) {

  let { acceptContract, credentialSubject, scanned, substitute } = route.params

  let credSubjArray = []
  if (credentialSubject != null) {
    credSubjArray = Array.isArray(credentialSubject) ? credentialSubject : [ credentialSubject ]
  } else if (scanned != null) {
    let scannedCred = JSON.parse(scanned)
    credSubjArray = Array.isArray(scannedCred) ? scannedCred : [ scannedCred ]
  }

  const id0 = appStore.getState().identifiers && appStore.getState().identifiers[0]

  const allFinalCredSubjs = []
  const privateFields = []
  for (subj of credSubjArray) {
    if (utility.isContract(subj)) {
      const strippedContract = R.clone(subj)
      const erasedPrivates = R.clone(subj.fields)
      delete strippedContract.fields
      if (acceptContract) {
        allFinalCredSubjs.push(utility.constructAccept(id0.did, strippedContract))
        privateFields.push(erasedPrivates)
      } else {
        allFinalCredSubjs.push(strippedContract)
        privateFields.push(erasedPrivates)
      }
    } else {
      allFinalCredSubjs.push(subj)
      privateFields.push(null)
    }
  }

  const [claimJsonError, setClaimJsonError] = useState<string>(null)
  const [claimArrayStr, setClaimArrayStr] = useState<string>(JSON.stringify(allFinalCredSubjs))
  const [hasMnemonic, setHasMnemonic] = useState<boolean>(false)
  const [sendToEndorser, setSendToEndorser] = useState<boolean>(true)

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

  function changeCurlyQuotes() {
    setClaimArrayStr(claimArrayStr.replace(/”/g, "\"").replace(/“/g, "\""))
  }
  function hasCurlyQuotes() {
    return claimArrayStr && (claimArrayStr.match(/”/) || claimArrayStr.match(/“/))
  }

  // Check for existing identifers on load and set them to state
  useEffect(() => {
    const getIdentifier = async () => {
      let settings = appStore.getState().settings
      if (settings && (settings.mnemEncrBase64 || settings.mnemonic)) {
        setHasMnemonic(true)
      }
    }
    getIdentifier()
  }, [])

  useEffect(() => {
    if (claimArrayStr == null || claimArrayStr.trim() == '') {
      setClaimJsonError('The claim is empty.')
    } else {

      try {
        JSON.stringify(JSON.parse(claimArrayStr), null, 2)
        setClaimJsonError('')
      } catch (err) {
        setClaimJsonError('The claim is not formatted correctly. ' + err)
      }

      if (substitute) {
        let newClaimStr = claimArrayStr
        if (id0) {
          newClaimStr = claimArrayStr.replace(utility.REPLACE_USER_DID_STRING, id0.did)
        }
        setClaimArrayStr(newClaimStr)
      }

    }
  }, [claimArrayStr, id0])

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
                {
                  claimArrayStr ? (
                    <View>
                      <Text>Hit 'sign' if the Details below are good.</Text>
                    </View>
                  ) : ( /* !claimArrayStr */
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
                              acceptContract,
                              identifier: id0,
                              credentialSubjects: JSON.parse(claimArrayStr),
                              privateFields,
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

                  <Text style={{ marginTop: 75, marginBottom: 5, fontSize: 20, fontWeight: 'bold' }}>Details</Text>
                  <YamlFormat source={ JSON.parse(claimArrayStr) } />
                  <Text style={{ marginTop: 200, marginBottom: 5, fontSize: 20, fontWeight: 'bold' }}>Technical Details</Text>
                  <Text style={{ fontSize: 11 }}>Signing As:</Text>
                  <Text style={{ fontSize: 11 }}>{id0.did}</Text>
                  { !hasMnemonic ? (
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
                    hasCurlyQuotes()
                    ?
                      <Button
                        title={'Change Curly Quotes To Regular Quotes'}
                        onPress={changeCurlyQuotes}
                      />
                    :
                      <View/>
                  }

                  <Text>Private Fields (can't be edited, only stored locally)</Text>
                  <TextInput
                    multiline={true}
                    style={{ borderWidth: 1, height: 300 }}
                    editable={false}
                  >
                    { formatClaimJson(privateFields) }
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
