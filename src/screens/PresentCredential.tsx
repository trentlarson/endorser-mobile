import React, { useState } from 'react'
import { ActivityIndicator, SafeAreaView, ScrollView, Text, View } from 'react-native'
import QRCode from "react-native-qrcode-svg"
import { useFocusEffect } from '@react-navigation/native'
import { ICreateVerifiablePresentationArgs } from '@veramo/credentials-w3c'

import { appStore } from '../veramo/appSlice'
import { agent } from '../veramo/setup'

export function PresentCredentialScreen({ navigation, route }) {

  const { fullClaim } = route.params

  const [prezStr, setPrezStr] = useState<string>()
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

        let vpStr
        if (false && identifiers.length > 0) {
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
          vpStr = JSON.stringify(vp)
        }

        const qrStr = (vpStr || vcStr)
        if (qrStr.length > 2331) {
          // It's larger than allowed for default error correction. https://www.npmjs.com/package/qrcode#qr-code-capacity
          // (Trial and error shows that it can render if a little bigger but not too much.)
          setErrorMsg('Error: The presentation data is too much for a QR code.')
        } else {
          setPrezStr(qrStr)
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
                : <QRCode value={prezStr} size={300} onError={ err => {setErrorMsg(err.toString()) /* Gives an 'update a component' complaint but cannot get around it. */} }/>
            }
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
