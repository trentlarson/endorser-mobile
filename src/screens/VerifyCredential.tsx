import didJwt from 'did-jwt'
import { DateTime, Duration } from 'luxon'
import * as R from 'ramda'
import React, { useState } from 'react'
import { ActivityIndicator, Button, SafeAreaView, ScrollView, Text, View } from 'react-native'
import QRCodeScanner from 'react-native-qrcode-scanner'
import { useFocusEffect } from '@react-navigation/native'
import { useSelector } from 'react-redux'

import { styles } from './style'
import * as utility from '../utility/utility'
import { VisibleDidModal, YamlFormat } from '../utility/utility.tsx'
import { appSlice, appStore } from '../veramo/appSlice'
import { agent, dbConnection, DEFAULT_BASIC_RESOLVER } from '../veramo/setup'

export function ScanPresentationScreen({ navigation }) {

  const onSuccessfulQrEvent = async (e) => {
    onSuccessfulQrText(e.data)
  }

  const onSuccessfulQrText = async (qrText) => {
    navigation.navigate('Verify Credential', { vcStr: qrText })
  }

  return (
    <SafeAreaView>
      <ScrollView>
        <View style={{ padding: 20 }}>
          <Text style={{ fontSize: 30, fontWeight: 'bold' }}>Scan</Text>
          <QRCodeScanner onRead={onSuccessfulQrEvent} />
          { appStore.getState().testMode
            ? <View>
                <Button
                  title='Fake 333 Pres'
                  onPress={() => onSuccessfulQrText(id19_333Pres)}
                />
                <Button
                  title='Fake 444 Carpentry'
                  onPress={() => onSuccessfulQrText(id32_444Carpentry)}
                />
                <Button
                  title='Fake 777 Carpentry'
                  onPress={() => onSuccessfulQrText(id28_777Carpentry)}
                />
                <Button
                  title='Fake & Invalid 777'
                  onPress={() => onSuccessfulQrText(id28_777Bad)}
                />
              </View>
            : <View/>
          }
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

export function VerifyCredentialScreen({ navigation, route }) {

  // wrappedClaim is directly from Endorser server
  // vc is Verified Credential format
  const { vc, vcStr, wrappedClaim } = route.params

  const vcObj = vc || (vcStr && JSON.parse(vcStr))

  const [confirmError, setConfirmError] = useState<string>('')
  const [credentialSubject, setCredentialSubject] = useState<any>(undefined)
  const [credentialSubjectsMatch, setCredentialSubjectsMatch] = useState<boolean>(false)
  const [detectedSigInvalid, setDetectedSigInvalid] = useState<boolean>(false)
  const [detectedSigProblem, setDetectedSigProblem] = useState<boolean>(false)
  const [detectedSigValid, setDetectedSigValid] = useState<boolean>(false)
  const [didForVisibleModal, setDidForVisibleModal] = useState<string>(null)
  const [endorserId, setEndorserId] = useState<string>('')
  const [howLongAgo, setHowLongAgo] = useState<string>('')
  const [issuer, setIssuer] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(true)
  const [numHidden, setNumHidden] = useState<number>(0)
  const [visibleIdList, setVisibleIdList] = useState([])
  const [visibleTo, setVisibleTo] = useState<string[]>([])

  const identifiers = useSelector((state) => state.identifiers || [])
  const allContacts = useSelector((state) => state.contacts || [])

  useFocusEffect(
    React.useCallback(() => {
      async function verifyAll() {

        setLoading(true)
        setConfirmError('')
        setDetectedSigInvalid(false)
        setDetectedSigProblem(false)
        setDetectedSigValid(false)
        setHowLongAgo('')

        if (wrappedClaim) {
          setCredentialSubject(wrappedClaim.claim)
        }

        if (vcObj) {
          // this checks the JWT time
          const then = DateTime.fromISO(vcObj.issuanceDate)
          setHowLongAgo(then.toRelativeCalendar())
        }

        let verifiedResponse: JWTVerified = undefined
        if (vcObj) {
          // this checks the JWT signature

          try {

            verifiedResponse = await didJwt.verifyJWT(vcObj.proof.jwt, {resolver: DEFAULT_BASIC_RESOLVER, auth: true})
            //console.log("verifiedResponse",verifiedResponse)

            // if we're here, it must have passed validation
            setDetectedSigValid(true)

          } catch (e) {
            if (e.toString().indexOf('Signature invalid for JWT') > -1) {
              setDetectedSigInvalid(true)
            } else {
              setDetectedSigProblem(true)
              console.log('Got unknown error verifying JWT:', e)
            }
          }
        }

        if (verifiedResponse) {

          // check that the contents inside and outside the JWT match
          if (verifiedResponse.payload.vc
              && verifiedResponse.payload.vc.credentialSubject) {
            setCredentialSubject(verifiedResponse.payload.vc.credentialSubject)
            if (vcObj.credentialSubject) {
              setCredentialSubjectsMatch(R.equals(vcObj.credentialSubject, verifiedResponse.payload.vc.credentialSubject))
            } else {
              // nothing to compare to, so don't say it doesn't match
              setCredentialSubjectsMatch(true)
            }
          } else {
            // no signed credentialSubject exists... not good
          }

          setIssuer(verifiedResponse.issuer)

          // there's also a signer.id ... is it ever different?
        }

        {
          // this retrieves confirmations

          let foundEndorserId
          if (wrappedClaim) {
            foundEndorserId = wrappedClaim.id

          } else if (vcObj) {
            const endorserSubstring = '/api/claim/'
            const endorIndex = !vcObj.id ? -1 : vcObj.id.indexOf(endorserSubstring)
            if (vcObj['type']
                && vcObj['type'].findIndex(elem => elem === 'VerifiableCredential') > -1
                && endorIndex > -1) {
              foundEndorserId = vcObj.id.substring(endorIndex + endorserSubstring.length)
            }
          }

          if (foundEndorserId) {

            setEndorserId(foundEndorserId)

            const url = appStore.getState().apiServer + '/api/report/issuersWhoClaimedOrConfirmed?claimId=' + foundEndorserId
            const userToken = await utility.accessToken(identifiers[0])
            await fetch(url, {
              headers: {
                "Content-Type": "application/json",
                "Uport-Push-Token": userToken
              }})
              .then(response => {
                if (response.status === 200) {
                  return response.json()
                } else {
                  throw ('Got bad response status of ' + response.status)
                }
              })
              .then(result => {
                let resultList1 = result.result || []
                let resultList2 = R.reject(utility.isHiddenDid, resultList1)
                setVisibleIdList(resultList2)
                setNumHidden(resultList1.length - resultList2.length)

                setVisibleTo(result.resultVisibleToDids || [])
              })
              .catch(e => {
                console.log('Something went wrong trying to access data.', e)
                setConfirmError('Something went wrong trying to access data.')
              })

          }
        }
        setLoading(false)
      }

      verifyAll()

    }, [])
  )

  return (
    <SafeAreaView>
      <ScrollView>
        <View style={{ padding: 20 }}>
          <Text style={{ fontSize: 30, fontWeight: 'bold' }}>Details</Text>
          {
            loading
            ? <ActivityIndicator color="#00FF00" />
            : <View style={{ marginTop: 20}}/>
          }
          <Text style={{ fontSize: 20, fontWeight: 'bold', marginTop: 20 }}>Claim</Text>
          <YamlFormat source={credentialSubject} navigation={navigation} />

          <View style={styles.line} />{/*----------------------------------------------------------------*/}

          <Text style={{ fontSize: 20, fontWeight: 'bold', marginTop: 20 }}>Confirmations</Text>

          {
            loading
            ? <ActivityIndicator color="#00FF00" />
            : <View style={{ marginTop: 20}}/>
          }

          {/* Show any directly visible. */}
          <View style={{ padding: 5 }}>
            <Text>
              {
                visibleIdList.length > 0
                ? 'This is confirmed by these in your network:'
                : 'This is not confirmed by anyone in your network.'
              }
            </Text>
            {
              visibleIdList.map(did => <Text key={did} selectable={true}>* { utility.didInContext(did, identifiers, allContacts) }</Text>)
            }
          </View>


          {/* Now show how to get to those hidden. */}
          <View style={{ padding: 5 }}>
            <Text>
              {
                visibleTo.length > 0
                ? 'Those who confirmed are visible to these others in your network:'
                : 'Anyone else who confirmed is not visible to those in your network.'
              }
            </Text>
            {
              visibleTo.map(did => <Text key={did} style={{ color: 'blue', fontSize: 11 }} selectable={true} onPress={() => setDidForVisibleModal(did)}>* {did}</Text>)
            }
          </View>
          {
            endorserId && (visibleIdList.length > 0 || visibleTo.length > 0)
            ? <View style={{ padding: 5 }}>
                <Text>To get more details, send this claim ID to one of those people and ask them to search for more information:</Text>
                <Text style={{ padding: 10 }} selectable={true}>{ endorserId }</Text>
              </View>
            : <View />
          }


          {/* Now show number hidden. */}
          <View style={{ padding: 5 }}>
            <Text>{ 'There are ' + (numHidden > 0 ? 'confirmations by ' + numHidden : 'no confirmations by anyone') + ' outside your network.' }</Text>
          </View>


          <View style={{ padding: 5 }}>
            <Text>{ confirmError }</Text>
          </View>


          <Text style={{ fontSize: 20, fontWeight: 'bold', marginTop: 20 }}>Validity</Text>
          {
            vcObj
            ? (
              <View>
                <View style={{ flex: 1, flexDirection: 'row' }}>
                  <Text style={{ width: '20%' }}>Issuer</Text>
                  <Text style={{ width: '80%' }} selectable={true}>{ utility.didInContext(issuer, identifiers, allContacts) }</Text>
                </View>
                {
                  credentialSubject
                  ?
                    <View style={{ flex: 1, flexDirection: 'row' }}>
                      <Text style={{ width: '30%' }}>Consistent?</Text>
                      <Text>{ credentialSubjectsMatch ? 'Yes' : 'No' }</Text>
                    </View>
                  :
                    <View/>
                }
                <View style={{ flex: 1, flexDirection: 'row' }}>
                  <Text style={{ width: '30%' }}>Valid Signature?</Text>
                  <Text style={{ width: '70%' }}>
                    { detectedSigValid ? 'Yes' : '' }
                    { detectedSigInvalid ? 'No, the signature is not valid!' : '' }
                    { detectedSigProblem ? 'No... it is not outright fraud but there is something wrong with it.' : '' }
                  </Text>
                </View>
                <View style={{ flex: 1, flexDirection: 'row' }}>
                  <Text style={{ width: '30%' }}>When</Text>
                  <Text>{ howLongAgo }</Text>
                </View>
              </View>
            ) : (
              <Text>There is no validity information.</Text>
            )
          }

          <VisibleDidModal didForVisibility={didForVisibleModal} setDidForVisibility={setDidForVisibleModal} />

          <View style={{ height: 0.8, width: "100%", backgroundColor: "#000000", marginTop: 200, marginBottom: 100 }} />
          <Text style={{ fontSize: 20, fontWeight: 'bold' }}>Details</Text>
          {
            endorserId != null
            ? <View><Text>ID on Server</Text><Text selectable={true}>{endorserId}</Text></View>
            : <View />
          }
          <Text selectable={true}>{ vcObj ? JSON.stringify(vcObj) : '' }</Text>
          <Text selectable={true}>{ wrappedClaim ? JSON.stringify(wrappedClaim) : '' }</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const id32_444Carpentry = '{"credentialSubject":{"@context":"http://schema.org","@type":"Person","name":"Person","identifier":"did:ethr:0x444D276f087158212d9aA4B6c85C28b9F7994AAC","knowsAbout":"carpentry"},"issuer":{"id":"did:ethr:0x444D276f087158212d9aA4B6c85C28b9F7994AAC"},"id":"http://192.168.1.5:3000/api/claim/32","type":["VerifiableCredential"],"@context":["https://www.w3.org/2018/credentials/v1"],"issuanceDate":"2021-05-09T01:31:23.000Z","proof":{"type":"JwtProof2020","jwt":"eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NksifQ.eyJ2YyI6eyJjcmVkZW50aWFsU3ViamVjdCI6eyJAY29udGV4dCI6Imh0dHA6Ly9zY2hlbWEub3JnIiwiQHR5cGUiOiJQZXJzb24iLCJuYW1lIjoiUGVyc29uIiwiaWRlbnRpZmllciI6ImRpZDpldGhyOjB4NDQ0RDI3NmYwODcxNTgyMTJkOWFBNEI2Yzg1QzI4YjlGNzk5NEFBQyIsImtub3dzQWJvdXQiOiJjYXJwZW50cnkifSwiQGNvbnRleHQiOlsiaHR0cHM6Ly93d3cudzMub3JnLzIwMTgvY3JlZGVudGlhbHMvdjEiXSwidHlwZSI6WyJWZXJpZmlhYmxlQ3JlZGVudGlhbCJdfSwianRpIjoiaHR0cDovLzE5Mi4xNjguMS41OjMwMDAvYXBpL2NsYWltLzMxIiwibmJmIjoxNjIwNTIzODgzLCJpc3MiOiJkaWQ6ZXRocjoweDQ0NEQyNzZmMDg3MTU4MjEyZDlhQTRCNmM4NUMyOGI5Rjc5OTRBQUMifQ.Dt7YSHYsgTAzgAL3z-DVMsLGAo0Np1LQZeabrREgoD190htbsh9m8bUjtWE1qDvXnsc6iv49ZlUXEpodYXhQkA"}}'

const id19_333Pres = '{"credentialSubject":{"@context":"http://schema.org","@type":"Organization","name":"Cottonwood Cryptography Club","member":{"@type":"OrganizationRole","member":{"@type":"Person","identifier":"did:ethr:0x3334FE5a696151dc4D0D03Ff3FbAa2B60568E06a"},"roleName":"President","startDate":"2019-04-01","endDate":"2020-03-31"}},"issuer":{"id":"did:ethr:0x3334FE5a696151dc4D0D03Ff3FbAa2B60568E06a"},"id":"http://192.168.1.5:3000/api/claim/19","type":["VerifiableCredential"],"@context":["https://www.w3.org/2018/credentials/v1"],"issuanceDate":"2021-05-08T21:21:27.000Z","proof":{"type":"JwtProof2020","jwt":"eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NksifQ.eyJ2YyI6eyJjcmVkZW50aWFsU3ViamVjdCI6eyJAY29udGV4dCI6Imh0dHA6Ly9zY2hlbWEub3JnIiwiQHR5cGUiOiJPcmdhbml6YXRpb24iLCJuYW1lIjoiQ290dG9ud29vZCBDcnlwdG9ncmFwaHkgQ2x1YiIsIm1lbWJlciI6eyJAdHlwZSI6Ik9yZ2FuaXphdGlvblJvbGUiLCJtZW1iZXIiOnsiQHR5cGUiOiJQZXJzb24iLCJpZGVudGlmaWVyIjoiZGlkOmV0aHI6MHgzMzM0RkU1YTY5NjE1MWRjNEQwRDAzRmYzRmJBYTJCNjA1NjhFMDZhIn0sInJvbGVOYW1lIjoiUHJlc2lkZW50Iiwic3RhcnREYXRlIjoiMjAxOS0wNC0wMSIsImVuZERhdGUiOiIyMDIwLTAzLTMxIn19LCJAY29udGV4dCI6WyJodHRwczovL3d3dy53My5vcmcvMjAxOC9jcmVkZW50aWFscy92MSJdLCJ0eXBlIjpbIlZlcmlmaWFibGVDcmVkZW50aWFsIl19LCJqdGkiOiJodHRwOi8vMTkyLjE2OC4xLjU6MzAwMC9hcGkvY2xhaW0vMTkiLCJuYmYiOjE2MjA1MDg4ODcsImlzcyI6ImRpZDpldGhyOjB4MzMzNEZFNWE2OTYxNTFkYzREMEQwM0ZmM0ZiQWEyQjYwNTY4RTA2YSJ9.rHD5ideZ4G5eWaUmQd6BAZZHXm1YIn0aUe9MSFP9uw9o88rHaWBmsHwi8MTBVs6_ALlRcZJLr8RTvGYM205FgA"}}'

const id28_777Carpentry = '{"credentialSubject":{"@context":"http://schema.org","@type":"Person","name":"Person","identifier":"did:ethr:0x777cd7E7761b53EFEEF01E8c7F8F0461b0a2DAdc","knowsAbout":"carpentry"},"issuer":{"id":"did:ethr:0x777cd7E7761b53EFEEF01E8c7F8F0461b0a2DAdc"},"id":"http://192.168.1.5:3000/api/claim/28","type":["VerifiableCredential"],"@context":["https://www.w3.org/2018/credentials/v1"],"issuanceDate":"2021-05-09T16:17:43.000Z","proof":{"type":"JwtProof2020","jwt":"eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NksifQ.eyJ2YyI6eyJjcmVkZW50aWFsU3ViamVjdCI6eyJAY29udGV4dCI6Imh0dHA6Ly9zY2hlbWEub3JnIiwiQHR5cGUiOiJQZXJzb24iLCJuYW1lIjoiUGVyc29uIiwiaWRlbnRpZmllciI6ImRpZDpldGhyOjB4Nzc3Y2Q3RTc3NjFiNTNFRkVFRjAxRThjN0Y4RjA0NjFiMGEyREFkYyIsImtub3dzQWJvdXQiOiJjYXJwZW50cnkifSwiQGNvbnRleHQiOlsiaHR0cHM6Ly93d3cudzMub3JnLzIwMTgvY3JlZGVudGlhbHMvdjEiXSwidHlwZSI6WyJWZXJpZmlhYmxlQ3JlZGVudGlhbCJdfSwianRpIjoiaHR0cDovLzE5Mi4xNjguMS41OjMwMDAvYXBpL2NsYWltLzI4IiwibmJmIjoxNjIwNTc3MDYzLCJpc3MiOiJkaWQ6ZXRocjoweDc3N2NkN0U3NzYxYjUzRUZFRUYwMUU4YzdGOEYwNDYxYjBhMkRBZGMifQ.VgGG2BDu40GHvpPxCLGjeDUu1SiJV_0n6TPormPdVThbluatKpZn8g3lPU1XbFsRGsqnGAZVZ18qz2y6FLVyoQ"}}'

const id28_777Bad = '{"credentialSubject":{"@context":"http://schema.org","@type":"Person","name":"Person","identifier":"did:ethr:0x777cd7E7761b53EFEEF01E8c7F8F0461b0a2DAdc","knowsAbout":"carpentry"},"issuer":{"id":"did:ethr:0x777cd7E7761b53EFEEF01E8c7F8F0461b0a2DAdc"},"id":"http://192.168.1.5:3000/api/claim/28","type":["VerifiableCredential"],"@context":["https://www.w3.org/2018/credentials/v1"],"issuanceDate":"2020-05-09T16:17:43.000Z","proof":{"type":"JwtProof2020","jwt":"eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NksifQ.eyJ2YyI6eyJjcmVkZW50aWFsU3ViamVjdCI6eyJAY29udGV4dCI6Imh0dHA6Ly9zY2hlbWEub3JnIiwiQHR5cGUiOiJQZXJzb24iLCJuYW1lIjoiUGVyc29uIiwiaWRlbnRpZmllciI6ImRpZDpldGhyOjB4Nzc3Y2Q3RTc3NjFiNTNFRkVFRjAxRThjN0Y4RjA0NjFiMGEyREFkYyIsImtub3dzQWJvdXQiOiJjYXJwZW50cnkifSwiQGNvbnRleHQiOlsiaHR0cHM6Ly93d3cudzMub3JnLzIwMTgvY3JlZGVudGlhbHMvdjEiXSwidHlwZSI6WyJWZXJpZmlhYmxlQ3JlZGVudGlhbCJdfSwianRpIjoiaHR0cDovLzE5Mi4xNjguMS41OjMwMDAvYXBpL2NsYWltLzI4IiwibmJmIjoxNjIwNTc3MDYzLCJpc3MiOiJkaWQ6ZXRocjoweDc3N2NkN0U3NzYxYjUzRUZFRUYwMUU4YzdGOEYwNDYxYjBhMkRBZGMifQ.rHD5ideZ4G5eWaUmQd6BAZZHXm1YIn0aUe9MSFP9uw9o88rHaWBmsHwi8MTBVs6_ALlRcZJLr8RTvGYM205FgA"}}'
