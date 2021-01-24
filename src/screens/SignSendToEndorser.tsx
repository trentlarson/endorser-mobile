import * as didJwt from 'did-jwt'
import React, { useEffect, useState } from 'react'
import { SafeAreaView, ScrollView, View, Text, TextInput, Button } from 'react-native'

import { agent } from '../veramo/setup'

export function CredentialsScreen({ navigation }) {
  const [claim, setClaim] = useState<string>('')
  const [identifiers, setIdentifiers] = useState<Identifier[]>([])
  const [jwt, setJwt] = useState<JWT>()

  function bvcClaim(did: string, startTime: string) {
    return {
      '@context': 'http://schema.org',
      '@type': 'JoinAction',
      agent: {
        did: did,
      },
      event: {
        organizer: {
          name: 'Bountiful Voluntaryist Community',
        },
        name: 'Saturday Morning Meeting',
        startTime: startTime,
      }
    }
  }

  function vcPayload(did: string, claim: any): JwtCredentialPayload {
    return {
      sub: did,
      vc: {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiableCredential'],
        credentialSubject: claim
      }
    }
  }

  async function signAndSend() {
    /**
    // would like to use https://www.npmjs.com/package/did-jwt-vc
    // but: "TypeError: Object is not a constructor (evaluating 'new EthrDID')"
    const issuer: Issuer = new EthrDID({
      address: '0xf1232f840f3ad7d23fcdaa84d6c66dac24efb198',
      privateKey: 'd8b595680851765f38ea5405129244ba3cbad84467d190859f4c8b20c1ff6c75'
    })
    const vcJwt: JWT = await createVerifiableCredentialJwt(vcPayload, issuer)
    **/

    const signer = didJwt.SimpleSigner(identifiers[0].keys[0].privateKeyHex)
    const did = identifiers[0].did
    const vcJwt = await didJwt.createJWT(vcPayload(did, claim),{ issuer: did, signer })
    setJwt(vcJwt)
  }

  // Check for existing identifers on load and set them to state
  useEffect(() => {
    const getIdentifiers = async () => {
      const _ids = await agent.didManagerFind()
      setIdentifiers(_ids)
      setClaim(bvcClaim(identifiers[0] ? identifiers[0].did : 'UNKNOWN', '2021-01-24'))
    }
    getIdentifiers()
  }, [])

  return (
    <SafeAreaView>
      <ScrollView>
        <View style={{ padding: 20 }}>
          <Text style={{ fontSize: 30, fontWeight: 'bold' }}>Credentials</Text>
          <Text>{ identifiers[0] && `ID ${identifiers[0].did}`}
          </Text>
          <Button
            title={'Click to sign & store'}
            onPress={() => signAndSend()}
          />
          { jwt ? (
            <View>
              <Text>JWT</Text>
              <TextInput
                multiline={true}
                style={{ borderWidth: 1, height: 300 }}
                editable={false}
              >
                { jwt }
              </TextInput>
            </View>
          ) : (
            <Text/>
          )}
          <Text>Claim</Text>
          <TextInput
            multiline={true}
            style={{ borderWidth: 1, height: 300 }}
            onChangeText={setClaim}
          >
            { JSON.stringify(claim, null, 2) }
          </TextInput>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

