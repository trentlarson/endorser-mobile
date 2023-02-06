import Debug from 'debug'
import * as R from 'ramda'
import React, { useEffect, useState } from 'react'
import { Button, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native'
import { CheckBox } from "react-native-elements"

import { onboarding } from '../data/onboarding'
import * as utility from '../utility/utility'
import { YamlFormat } from '../utility/utility.tsx'
import { appSlice, appStore, DEFAULT_ENDORSER_API_SERVER, DEFAULT_ENDORSER_VIEW_SERVER } from '../veramo/appSlice'

const debug = Debug('endorser-mobile:review-credential')

export function ReviewToSignCredentialScreen({ navigation, route }) {

  const { acceptContract, credentialSubject, scannedText } = route.params

  const id0 = appStore.getState().identifiers && appStore.getState().identifiers[0]

  const [claimError, setClaimError] = useState<string>('')
  const [sendToEndorser, setSendToEndorser] = useState<boolean>(true)

  // fields are objects with keys & values
  const [CLAIM_ARRAY, SET_CLAIM_ARRAY] = useState<Array<any>>([])
  const [HAS_MNEMONIC, SET_HAS_MNEMONIC] = useState<boolean>(false)
  const [PRIVATE_FIELDS, SET_PRIVATE_FIELDS] = useState<Array<any>>([])

  function formatClaimJson(claimArray): string {
    return JSON.stringify(claimArray, null, 2)
  }

  function findContractWithCid(cid: string) {
    return R.find(def => def.templateIpfsCid === cid, R.values(onboarding))
  }

  useEffect(() => {
    const setAllClaimElements = async () => {
      try {
        let credSubjArray = []
        if (credentialSubject != null) {
          credSubjArray = Array.isArray(credentialSubject) ? credentialSubject : [ credentialSubject ]
        } else if (scannedText != null) {
          const newScannedText =
            !id0
            ? scannedText
            : scannedText.replace(new RegExp(utility.REPLACE_USER_DID_STRING, 'g'), id0.did)
          const scannedCred = JSON.parse(newScannedText)
          credSubjArray = Array.isArray(scannedCred) ? scannedCred : [ scannedCred ]
        }

        // add hashes for fields if they're missing
        // note that they may have come through via a scan of a Contract or a Contract AcceptAction
        for (const subj of credSubjArray) {
          const hasContractAndPrivateFields = utility.isContract(subj) && subj.fields
          const hasContractAcceptAndPrivateFields = utility.isContractAccept(subj) && subj.object.fields
          if (hasContractAndPrivateFields || hasContractAcceptAndPrivateFields) {
            const fields = subj.fields || (subj.object && subj.object.fields)

            let orderedFields = fields // hopefully these will be template-ordered soon
            let fieldsMerkle: string
            let contractFullMdHash: string
            const contractCid = subj.contractFormIpfsCid || (subj.object && subj.object.contractFormIpfsCid)
            const contractTemplate = R.find(x => x.templateIpfsCid == contractCid, R.values(onboarding))
            if (contractTemplate) {
              // orderedFields will have fields in the right order for the template
              orderedFields = utility.fieldsInsertionOrdered(contractTemplate.templateText, fields)
              contractFullMdHash = utility.contractHashHex(orderedFields, contractTemplate.templateText)
            }
            fieldsMerkle = utility.valuesMerkleRootHex(orderedFields)

            if (utility.isContract(subj)) {
              subj.fields = orderedFields
              subj.fieldsMerkle = fieldsMerkle
              subj.contractFullMdHash = contractFullMdHash
            } else { // must be isContractAccept
              subj.object.fields = orderedFields
              subj.object.fieldsMerkle = fieldsMerkle
              subj.object.contractFullMdHash = contractFullMdHash
            }
          }
        }

        // set agent for an Accept if not this person already
        for (const subj of credSubjArray) {
          if (utility.isAccept(subj)
              && (!subj.agent || subj.agent.identifier !== id0.did)) {
            subj.agent = { identifier: id0.did }
          }
        }

        const allFinalCredSubjs = []
        const allFinalPrivateFields = []

        // now separate any private data from shared-ledger data
        for (const subj of credSubjArray) {
          if (utility.isContract(subj)) {
            const strippedContract = R.clone(subj)
            const erasedPrivates = R.clone(subj.fields)
            delete strippedContract.fields
            if (acceptContract) {
              allFinalCredSubjs.push(utility.constructAccept(id0.did, strippedContract))
            } else {
              allFinalCredSubjs.push(strippedContract)
            }
            allFinalPrivateFields.push(erasedPrivates)
          } else if (utility.isContractAccept(subj)) {
            const strippedContract = R.clone(subj)
            const erasedPrivates = R.clone(subj.object.fields)
            delete strippedContract.object.fields
            allFinalCredSubjs.push(strippedContract)
            allFinalPrivateFields.push(erasedPrivates)
          } else {
            allFinalCredSubjs.push(subj)
            allFinalPrivateFields.push(null)
          }
        }

        SET_CLAIM_ARRAY(allFinalCredSubjs)
        SET_PRIVATE_FIELDS(allFinalPrivateFields)

      } catch (e) {
        setClaimError('Got an error working with that claim: ' + e)
        console.log('Error trying to initialize claims for signing:', e)
      }
    }
    setAllClaimElements()
  }, [credentialSubject])

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
              <Text>
                {
                  (appStore.getState().settings.apiServer !== DEFAULT_ENDORSER_API_SERVER)
                   ? "Custom Servers"
                   : ""
                }
              </Text>
              {
                claimError
                ? (
                  <Text style={{ textAlign: 'center' }}>Cannot Sign{'\n'}(More details below.)</Text>
                ) : (
                  <View />
                )
              }
              {
                CLAIM_ARRAY.length === 0
                ? (
                  <Text style={{ textAlign: 'center' }}>No claim available.</Text>
                ) : (
                  <View />
                )
              }
              <View>
                <View style={{ padding: 5 }} />
                {
                  claimError
                  ?
                  <Text style={{ textAlign: 'center' }}>Cannot Sign{'\n'}(More details below.)</Text>
                  :
                  <View>
                      <View>
                          <Text>Hit 'sign' if the Details below are acceptable.</Text>
                      </View>
                      <Button
                        disabled={ claimError || CLAIM_ARRAY.length === 0 }
                        title={'Sign'}
                        onPress={() => navigation.push(
                          'Signature Results',
                          {
                            identifier: id0,
                            credentialSubjects: CLAIM_ARRAY,
                            privateFields: PRIVATE_FIELDS,
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
                {
                  CLAIM_ARRAY.map((subj, index) =>
                    <View key={index}>
                        <View style={{ padding: 10 }} />
                        <Text>{ CLAIM_ARRAY.length < 2 ? "" : ("Claim #" + (index + 1)) }</Text>
                        {
                          (utility.isContract(subj) || utility.isContractAccept(subj))
                          ?
                          <Text
                            style={{ color: 'blue' }}
                            onPress={() => navigation.push(
                              'Contract Form',
                              {
                                nextScreen: utility.REVIEW_SIGN_SCREEN_NAV,
                                onboardingChoice: findContractWithCid(
                                  utility.isContractAccept(subj) ? subj.object.contractFormIpfsCid : subj.contractFormIpfsCid
                                ),
                                privateFields: PRIVATE_FIELDS[index],
                              }
                            )}
                          >
                              Edit Information
                          </Text>
                          :
                          <View />
                        }
                        <YamlFormat source={ subj } />
                        <YamlFormat source={ PRIVATE_FIELDS[index] } />
                    </View>
                  )
                }

                <Text style={{ marginTop: 200, marginBottom: 5, fontSize: 20, fontWeight: 'bold' }}>Technical Details</Text>
                <Text style={{ fontSize: 11 }}>Signing As:</Text>
                <Text style={{ fontSize: 11 }}>{id0.did}</Text>
                { !HAS_MNEMONIC ? (
                    <Text style={{ padding: 10, color: 'red' }}>There is no backup available for this ID. We recommend you generate a different identifier and do not keep using this one. (See Help.)</Text>
                ) : (
                    <Text/>
                  )}

                <Text>Shared Data</Text>
                <Text style={{ color: 'red' }}>{ claimError }</Text>
                <TextInput
                  editable={false}
                  multiline={true}
                  style={{ borderWidth: 1 }}
                >
                    { formatClaimJson(CLAIM_ARRAY) }
                </TextInput>

                <Text>Private Fields</Text>
                <TextInput
                  editable={false}
                  multiline={true}
                  style={{ borderWidth: 1 }}
                >
                    { formatClaimJson(PRIVATE_FIELDS) }
                </TextInput>
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
