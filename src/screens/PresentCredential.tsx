import React, { useState } from 'react'
import { ActivityIndicator, Modal, SafeAreaView, ScrollView, Text, TextInput, View } from "react-native";
import QRCode from "react-native-qrcode-svg"
import Icon from 'react-native-vector-icons/FontAwesome'
import { useFocusEffect } from '@react-navigation/native'
import { ICreateVerifiablePresentationArgs } from '@veramo/credentials-w3c'

import { appStore } from '../veramo/appSlice'
import { agent } from '../veramo/setup'
import Clipboard from "@react-native-community/clipboard";
import { styles } from "./style";

// Here is a size that tested well for scanning with my phone.
// Maximums: https://www.npmjs.com/package/qrcode#qr-code-capacity
// Tables: https://www.qrcode.com/en/about/version.html
// (Trial and error shows that QRCode can handle a max of 2342.)
const MAX_QR_BYTES = 1000 // 1133 resolution sometimes works; 1134 jumps to the next resolution that works less often

export function PresentCredentialScreen({ navigation, route }) {

  const { fullClaim } = route.params

  const [fullPrezStr, setFullPrezStr] = useState<Array<string>>()
  const [prezStrs, setPrezStrs] = useState<Array<string>>()
  const [quickMessage, setQuickMessage] = useState<string>(null)
  const [qrMessage, setQrMessage] = useState<string>()
  const [errorMsg, setErrorMsg] = useState<string>()
  const [loading, setLoading] = useState<boolean>(true)

  const copyToClipboard = (value) => {
    Clipboard.setString(value)
    setQuickMessage('Copied')
    setTimeout(() => { setQuickMessage(null) }, 1000)
  }

  useFocusEffect(
    React.useCallback(() => {
      async function createPresentation() {

        // based on https://github.com/uport-project/veramo/blob/next/packages/credential-w3c/src/__tests__/action-handler.test.ts#L86
        let identifiers = appStore.getState().identifiers
        const vc = await agent.createVerifiableCredential({
          credential: {

            // Many of the following notes may be particular to Veramo.

            credentialSubject: fullClaim.claim,

            // 'exp' is not found in the full VP
            // this adds 'expirationDate' ISO string to full VP
            // 'exp' is added to proof jwt as 'exp' epoch number
            exp: Math.round(new Date().valueOf() / 1000 + (100 * 365 * 24 * 60 * 60)),

            // this adds 'issuanceDate' ISO string to full VP (along with iat)
            // 'iat' is added to proof jwt as 'iat' epoch number
            iat: Math.round(new Date().valueOf() / 1000),

            // 'id' is found in the full VP but only 'jti' is found in the final proof
            // this is added as 'jti' in each VC
            id: appStore.getState().settings.apiServer + '/api/claim/' + fullClaim.id,

            issuer: { id: identifiers[0].did },
          }
        })
        const vcStr = JSON.stringify(vc)

        if (identifiers.length > 0) {
          // Verifiable types found here: https://github.com/uport-project/veramo/blob/next/packages/core/src/types/IMessage.ts
          // These will be automatically filled in: @context, type, nbf (as current time)
          // ... according to https://github.com/uport-project/veramo/blob/next/packages/credential-w3c/src/action-handler.ts#L50
          const vpArgs: ICreateVerifiablePresentationArgs = {
            presentation: {

              // 'holder' is added to proof jwt as 'iss'
              holder: identifiers[0].did,

              // 'exp' is not found in full VP
              // this adds 'expirationDate' ISO string to full VP
              // 'exp' is added to proof jwt as 'exp' epoch number
              exp: Math.round(new Date().valueOf() / 1000 + (100 * 365 * 24 * 60 * 60)),

              // this adds 'issuanceDate' ISO string to full VP (along with iat)
              // 'iat' is added to proof jwt as 'iat' epoch number
              iat: Math.round(new Date().valueOf() / 1000),

              // included in signed content under vp.verifiableCredential with each VC represented as a JWT string
              verifiableCredential: [vc],
            }
          }
          const vp = await agent.createVerifiablePresentation(vpArgs)
          const vpStr = JSON.stringify(vp)

          setFullPrezStr(vpStr)

          const qrStrs = []
          let index = 0
          while (index < vpStr.length) {
            let nextIndex = index + MAX_QR_BYTES
            qrStrs.push(vpStr.substring(index, nextIndex))
            index = nextIndex
          }
          if (qrStrs.length > 0) {
            setQrMessage('Note that the presentation data is too much for one QR code, so recipients must "Scan Multiple" to scan each of these.')
          }
          setPrezStrs(qrStrs)

        } else {
          setErrorMsg('Error: You have no identifier for signing. Go to Settings and create one.')
        }

      }

      createPresentation().then(() => setLoading(false))

    }, [])
  )

  return (
    <SafeAreaView>
      <ScrollView>
        <View style={{ padding: 20 }}>
          <Text style={{ fontSize: 30, fontWeight: 'bold' }}>{ fullClaim.claim['@type'] || 'Unknown Type' }</Text>
          <View>
            { loading
              ? <ActivityIndicator color="#00FF00" />
              : errorMsg
                ? <Text>{errorMsg}</Text>
                : <View>
                    <Text>{ qrMessage }</Text>
                    <View style={{ marginTop: 70 }} />
                    {
                      prezStrs.map((prez, index, array) =>
                        <View key={ index }>
                          <Text>{array.length === 1 ? '' : '#' + (index + 1)}</Text>
                          <QRCode value={ prez } size={ 300 } onError={ err => {setErrorMsg(err.toString()) /* Gives an 'update a component' complaint but cannot get around it. */} }/>
                          {
                            index < array.length - 1
                            ? <Text style={{ marginTop: 10, marginBottom: 80 }}>Scroll down for the next.</Text>
                            : array.length > 1
                              ? <Text style={{ marginTop: 10 }}>That completes your presentation.</Text>
                              : <Text />
                          }
                        </View>
                      )
                    }

                    <Text style={{ fontSize: 20, fontWeight: 'bold', marginTop: 100 }}>
                      Full Text
                      &nbsp;
                      <Icon
                        name="copy"
                        style={{ color: 'blue', fontSize: 20 }}
                        onPress={ () => copyToClipboard(fullPrezStr) }
                      />
                    </Text>
                    <TextInput
                      editable={false}
                      multiline={true}
                      style={{ borderWidth: 1 }}
                    >
                      { JSON.stringify(JSON.parse(fullPrezStr), null, 2) }
                    </TextInput>

                  </View>
            }

            <Modal
              animationType="slide"
              transparent={true}
              visible={!!quickMessage}
            >
              <View style={styles.centeredView}>
                <View style={styles.modalView}>
                  <Text>{ quickMessage }</Text>
                </View>
              </View>
            </Modal>

          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
