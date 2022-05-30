import React, { useState } from 'react'
import { ActivityIndicator, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native'
import QRCode from "react-native-qrcode-svg"
import { useFocusEffect } from '@react-navigation/native'
import { ICreateVerifiablePresentationArgs } from '@veramo/credentials-w3c'

import { appStore } from '../veramo/appSlice'
import { agent } from '../veramo/setup'

// Here is a size that tested well for scanning with my phone.
// Maximums: https://www.npmjs.com/package/qrcode#qr-code-capacity
// Tables: https://www.qrcode.com/en/about/version.html
// (Trial and error shows that QRCode can handle a max of 2342.)
const MAX_QR_BYTES = 1133 // 1134 jumps to the next resolution

export function PresentCredentialScreen({ navigation, route }) {

  const { fullClaim } = route.params

  const [fullPrezStr, setFullPrezStr] = useState<Array<string>>()
  const [prezStrs, setPrezStrs] = useState<Array<string>>()
  const [qrMessage, setQrMessage] = useState<string>()
  const [errorMsg, setErrorMsg] = useState<string>()
  const [loading, setLoading] = useState<boolean>(true)

  useFocusEffect(
    React.useCallback(() => {
      async function createPresentation() {

        // based on https://github.com/uport-project/veramo/blob/next/packages/credential-w3c/src/__tests__/action-handler.test.ts#L86
        let identifiers = appStore.getState().identifiers
        const vc = await agent.createVerifiableCredential({
          credential: {
            credentialSubject: fullClaim.claim,
            id: appStore.getState().apiServer + '/api/claim/' + fullClaim.id,
            issuer: { id: identifiers[0].did },
          }
        })
        const vcStr = JSON.stringify(vc)

        if (identifiers.length > 0) {
          // Verifiable types found here: https://github.com/uport-project/veramo/blob/next/packages/core/src/types/IMessage.ts
          // These will be automatically filled in: @context, type, issuanceDate
          // ... according to https://github.com/uport-project/veramo/blob/next/packages/credential-w3c/src/action-handler.ts#L50
          const vpArgs: ICreateVerifiablePresentationArgs = {
            presentation: {
              holder: identifiers[0].did,
              verifiableCredential: [vc],
              //verifier: [...]
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
                    <View style={{ marginTop: 100 }} />
                    {
                      prezStrs.map((prez, index, array) =>
                        <View key={ index }>
                          <QRCode value={ prez } size={ 300 } onError={ err => {setErrorMsg(err.toString()) /* Gives an 'update a component' complaint but cannot get around it. */} }/>
                          {
                            index < array.length - 1
                            ? <Text style={{ marginTop: 100, marginBottom: 100 }}>Scroll down for the next.</Text>
                            : <Text />
                          }
                        </View>
                      )
                    }

                    <Text style={{ fontSize: 20, fontWeight: 'bold', marginTop: 100 }}>Full Text</Text>
                    <TextInput
                      editable={false}
                      multiline={true}
                      style={{ borderWidth: 1, height: 300 }}
                    >
                      { JSON.stringify(JSON.parse(fullPrezStr), null, 2) }
                    </TextInput>

                  </View>
            }
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
