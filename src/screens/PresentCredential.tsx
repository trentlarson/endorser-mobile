import React, { useState } from 'react'
import { ActivityIndicator, SafeAreaView, ScrollView, Text, View } from 'react-native'
import QRCode from "react-native-qrcode-svg"
import { useFocusEffect } from '@react-navigation/native'

import { appStore } from '../veramo/appSlice'
import { agent } from '../veramo/setup'

export function PresentCredentialScreen({ navigation, route }) {

  const [credOrPrezStr, setCredOrPrezStr] = useState<string>()
  const [qrError, setQrError] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(true)

  const { fullClaim } = route.params

  useFocusEffect(
    React.useCallback(() => {
      async function createPresentation() {

        // based on https://github.com/uport-project/veramo/blob/next/packages/credential-w3c/src/__tests__/action-handler.test.ts#L86
        const vc = await agent.createVerifiableCredential({
          credential: {
            credentialSubject: fullClaim.claim,
            id: appStore.getState().apiServer + '/api/claim/' + fullClaim.id,
            issuer: { id: fullClaim.issuer },
          }
        })

        let vp
        /** These are currently too long, so you'll have to split into multiple QR codes.
        let identifiers = appStore.getState().identifiers
        if (identifiers.length > 0 && identifiers[0].did !== fullClaim.issuer) {
          // Verifiable types found here: https://github.com/uport-project/veramo/blob/next/packages/core/src/types/IMessage.ts
          // These will be automatically filled in: @context, type, issuanceDate
          // ... according to https://github.com/uport-project/veramo/blob/next/packages/credential-w3c/src/action-handler.ts#L50
          const vpArgs = {
            presentation: {
              holder: identifiers[0].did,
              verifier: [fullClaim.subject],
              verifiableCredential: [vc],
            }
          }
          vp = await agent.createVerifiablePresentation(vpArgs)
          console.log('vp length', JSON.stringify(vp).length, vp)
        }
        **/

        const qrObject = vp || vc

        setCredOrPrezStr(JSON.stringify(qrObject))
      }

      createPresentation().then(() => setLoading(false))

    }, [])
  )

  return (
    <SafeAreaView>
      <ScrollView>
        <View style={{ padding: 20 }}>
          <Text style={{ fontSize: 30, fontWeight: 'bold' }}>{ fullClaim.claim['@type'] || 'Unknown Type' }</Text>
          <View style={{ padding: 10 }}>
            { loading
              ? <ActivityIndicator color="#00FF00" />
              : qrError
                ? <Text>Cannot generate a QR code.</Text>
                : <QRCode value={credOrPrezStr} size={300} onError={setQrError}/>
            }
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
