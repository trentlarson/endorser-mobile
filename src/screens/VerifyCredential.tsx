import didJwt from 'did-jwt'
import { DateTime, Duration } from 'luxon'
import * as R from 'ramda'
import React, { useState } from 'react'
import { ActivityIndicator, Button, Modal, SafeAreaView, ScrollView, Text, View } from 'react-native'
import Clipboard from '@react-native-community/clipboard'
import { CheckBox } from 'react-native-elements'
import QRCodeScanner from 'react-native-qrcode-scanner'
import QRCode from "react-native-qrcode-svg"
import { useFocusEffect } from '@react-navigation/native'
import { useSelector } from 'react-redux'

import { styles } from './style'
import { PrivateData } from '../entity/privateData'
import * as utility from '../utility/utility'
import { VisibleDidModal, YamlFormat } from '../utility/utility.tsx'
import { appSlice, appStore } from '../veramo/appSlice'
import { agent, dbConnection, DEFAULT_BASIC_RESOLVER } from '../veramo/setup'

export function ScanPresentationScreen({ navigation }) {

  const [acceptScan, setAcceptScan] = useState<boolean>(true)
  const [numScanned, setNumScanned] = useState<number>(0)
  const [scanError, setScanError] = useState<boolean>(false)
  const [scanMultiple, setScanMultiple] = useState<boolean>(true)
  const [scanned, setScanned] = useState<string>('')

  const onSuccessfulQrEvent = async (e) => {
    setAcceptScan(false)
    onSuccessfulQrText(e.data)
  }

  const onSuccessfulQrText = async (qrText) => {

    const lastChar = qrText && qrText.slice(-1)
    if (qrText.length < 30
        && lastChar != '}' /* This is just in case we're really at the end*/) {
      // this happens a lot, where it scans a large barcode as a short code,
      // typically 8 numeric digits and classified as a "Product"
      setScanError(true)
    } else {

      const allScanned = scanned + qrText
      setNumScanned(prev => prev + 1)
      if (scanMultiple) {
        setScanned(allScanned)

        let parseSucceeded = false
        try {
          JSON.parse(allScanned)
          parseSucceeded = true;
        } catch (e) {
          //console.log('Parse failed:', e)
          // probably not at the end
        }
        if (parseSucceeded) {
          navigation.navigate('Verify Credential', { veriCredStr: allScanned })
        }
      } else {
        navigation.navigate('Verify Credential', { veriCredStr: allScanned })
      }
    }
  }

  return (
    <SafeAreaView>
      <ScrollView>
        <View style={{ padding: 20 }}>
          <Text style={{ fontSize: 30, fontWeight: 'bold' }}>Scan</Text>

          <CheckBox
            title={ 'Scan Multiple QR Codes' }
            checked={scanMultiple}
            onPress={() => {setScanMultiple(!scanMultiple)}}
          />
          {
            acceptScan && numScanned > 0
            ? <Text>{numScanned} scanned...</Text>
            : <Text />
          }

          {
            scanError ? (
              <View>
                <Text>That scan didn't register correctly.</Text>
                <Text>{numScanned} scanned, still incomplete.</Text>
                <Button
                  title={'Try again to scan #' + (numScanned + 1)}
                  onPress={() => {setScanError(false); setAcceptScan(true)} }
                />
              </View>
            ) : (
              acceptScan ? (
                <QRCodeScanner onRead={onSuccessfulQrEvent} reactivate={true} />
              ) : (
                <View>
                  <Text>{numScanned} scanned, still incomplete.</Text>
                  <Button
                    title={'Scan #' + (numScanned + 1)}
                    onPress={() => setAcceptScan(true) }
                  />
                </View>
              )
            )
          }

          { appStore.getState().testMode
            ? <View>
                <Button
                  title='Fake 333 Pres'
                  onPress={() => onSuccessfulQrText(id19_333Pres)}
                />
                <Button
                  title='Fake 333 Pres - Part 1'
                  onPress={() => onSuccessfulQrText(id19_333Pres_part1)}
                />
                <Button
                  title='Fake 333 Pres - Part 2'
                  onPress={() => onSuccessfulQrText(id19_333Pres_part2)}
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
                <QRCode value={id19_333Pres} size={300} />
              </View>
            : <View/>
          }
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

export function VerifyCredentialScreen({ navigation, route }) {

  // Only one of the following is expected:
  // - veriCred is Verified Credential
  // - veriCredStr is JSON.stringified Verified Credential
  // - wrappedClaim is directly from Endorser server (a utility.EndorserRecord),
  //   typically from previous search results
  const { veriCred, veriCredStr, wrappedClaim } = route.params

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
  const [quickMessage, setQuickMessage] = useState<string>(null)
  const [showMyQr, setShowMyQr] = useState<boolean>(false)
  const [veriCredObject, setVeriCredObject] = useState<any>()
  const [verifyError, setVerifyError] = useState<string>('')
  const [visibleIdList, setVisibleIdList] = useState<string[]>([])
  const [visibleTo, setVisibleTo] = useState<string[]>([])

  // These are set in an Effect, but they're just for caching so we should set once and not change.
  const [CONTRACT_ACCEPT, SET_CONTRACT_ACCEPT] = useState<any>({})
  const [PRIVATE_DATA, SET_PRIVATE_DATA] = useState<string>('')

  const identifiers = useSelector((state) => state.identifiers || [])
  const allContacts = useSelector((state) => state.contacts || [])

  const copyToClipboard = (text) => {
    Clipboard.setString(text)
    setQuickMessage('Copied')
    setTimeout(() => { setQuickMessage(null) }, 1000)
  }

  const acceptClaimForContract = (contractClaim, data) => {
    const contract = utility.constructContract(contractClaim.contractFormIpfsCid, data)
    contract.contractFullMdHash = contractClaim.contractFullMdHash
    contract.fieldsMerkle = contractClaim.fieldsMerkle
    const accept = utility.constructAccept(utility.REPLACE_USER_DID_STRING, contract)
    return accept
  }

  const proceedToEditOffer = (origClaim) => {
    const offerClaim = {
      '@context': utility.SCHEMA_ORG_CONTEXT,
      '@type': 'Offer',
      itemOffered: {
        '@type': 'CreativeWork',
        isPartOf: { '@type': origClaim['@type'], identifier: origClaim.identifier }
      }
    }
    if (!origClaim.identifier && wrappedClaim?.handleId) {
      offerClaim.itemOffered.isPartOf.identifier = wrappedClaim.handleId
    }
    navigation.navigate('Create Credential', { incomingClaim: offerClaim })
  }

  useFocusEffect(
    React.useCallback(() => {
      async function verifyAll() {

        // This is what we'll show as the full verifiable credential.
        // If from the server (from a wrappedClaim) then it's constructed from those pieces.
        let vcObj = veriCred || (veriCredStr && JSON.parse(veriCredStr))

        setLoading(true)
        setConfirmError('')
        setDetectedSigInvalid(false)
        setDetectedSigProblem(false)
        setDetectedSigValid(false)
        setHowLongAgo('')

        if (wrappedClaim) {
          setCredentialSubject(wrappedClaim.claim)
        }

        if (!vcObj && wrappedClaim) {
          // try to retrive a full VC

          const url = appStore.getState().settings.apiServer + '/api/claim/full/' + encodeURIComponent(wrappedClaim.id)
          const userToken = await utility.accessToken(identifiers[0])
          await fetch(url, {
            headers: {
              "Content-Type": "application/json",
              "Uport-Push-Token": userToken
            }})
            .then(async response => {
              if (response.status === 200) {
                return response.json()
              } else {
                const text = await response.text()
                let bodyText =
                  'While retrieving full claim, got bad response status of ' + response.status
                  + ' with text ' + text
                let userMessage = null
                // if the body is JSON, maybe we can show something more helpful
                try {
                  userMessage = JSON.parse(text).error?.message
                } catch (e) {
                  // continue and just use generic text
                }
                throw { userMessage: userMessage, bodyText: text }
              }
            })
            .then((result: utility.EndorserRecord) => {
              if (result.jwtEncoded) {
                // could take all these items except jwtEncoded from the original wrappedClaim
                vcObj = {
                  "@context": [ "https://www.w3.org/2018/credentials/v1" ],
                  credentialSubject: JSON.parse(result.claim),
                  id: appStore.getState().settings.apiServer + '/api/claim/' + result.id,
                  issuer: { id: result.issuer },
                  issuanceDate: result.issuedAt,
                  type: [ "VerifiableCredential" ],
                  proof: {
                    type: 'JwtProof2020',
                    jwt: result.jwtEncoded,
                  }
                }
              }
            })
            .catch(e => {
              appStore.dispatch(appSlice.actions.addLog({
                log: true,
                msg: "Something went wrong trying to access full JWT data from Endorser server. " + JSON.stringify(e)
              }))
              const message = e.userMessage || 'Could not access the full proof from Endorser server.'
              setVerifyError(message + ' The logs may show more info.')
            })
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
            //console.log("verifiedResponse", JSON.stringify(verifiedResponse, null, 2))

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
              setCredentialSubjectsMatch(
                R.equals(vcObj.credentialSubject, verifiedResponse.payload.vc.credentialSubject)
              )
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

            const url =
              appStore.getState().settings.apiServer
              + '/api/report/issuersWhoClaimedOrConfirmed?claimId=' + encodeURIComponent(foundEndorserId)
            const userToken = await utility.accessToken(identifiers[0])
            await fetch(url, {
              headers: {
                "Content-Type": "application/json",
                "Uport-Push-Token": userToken
              }})
              .then(async response => {
                if (response.status === 200) {
                  return response.json()
                } else {
                  const text = await response.text()
                  let bodyText =
                    'While retrieving confirmations, got bad response status of ' + response.status
                    + ' with text ' + text
                  let userMessage = null
                  // if the body is JSON, maybe we can show something more helpful
                  try {
                    userMessage = JSON.parse(text).error?.message
                  } catch (e) {
                    // continue and just use generic text
                  }
                  throw { userMessage: userMessage, bodyText: text }
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
                appStore.dispatch(appSlice.actions.addLog({
                  log: true,
                  msg: "Something went wrong trying to access confirmation data. " + JSON.stringify(e)
                }))
                const message = e.userMessage || 'Could not access confirmation data.'
                setConfirmError(message + ' The logs may show more info.')
              })

          }
        }

        {
          // this retrieves any private data
          let contractClaim
          if (utility.isContractAccept(vcObj)) {
            contractClaim = vcObj.object
          } else if (utility.isContractAccept(wrappedClaim?.claim)) {
            contractClaim = wrappedClaim.claim.object
          }
          if (contractClaim) {
            const conn = await dbConnection
            await conn.manager.findOne(PrivateData, {where: {contractFullMdHash: contractClaim.contractFullMdHash}})
            .then((foundContract) => {
              if (foundContract) {
                const claim = JSON.parse(foundContract.claim)
                SET_PRIVATE_DATA(claim.fields)
                SET_CONTRACT_ACCEPT(acceptClaimForContract(contractClaim, claim.fields))
              }
            })
          }
        }

        setVeriCredObject(vcObj)
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

          {
          PRIVATE_DATA
          ?
            <View>
              <Text style={{ fontSize: 20, fontWeight: 'bold', marginTop: 10 }}>Private Data</Text>
              <YamlFormat source={PRIVATE_DATA} />

              <View style={{ padding: 10 }} />
              <Text
                style={{ color: 'blue', ...styles.centeredText }}
                onPress={() => copyToClipboard(JSON.stringify(CONTRACT_ACCEPT))}
              >
                Copy Full Contract with Private Data to the Clipboard
              </Text>

              <View style={{ padding: 10 }} />
              <Text
                style={{ color: 'blue', ...styles.centeredText }}
                onPress={() => setShowMyQr(!showMyQr)}
              >
                { (showMyQr ? "Hide" : "Show") + " Full Contract with Private Data in a QR Code" }
              </Text>
              {
                showMyQr
                ?
                  <View style={{ marginBottom: 10, ...styles.centeredView}}>
                    <QRCode value={JSON.stringify(CONTRACT_ACCEPT)} size={300} />
                  </View>
                :
                  <View/>
              }

              <View style={{ padding: 10 }} />
            </View>
          :
            <View />
          }
          {/* end actions on private data */}

          {
          utility.isPlanAction(credentialSubject)
          ?
            <View>
              <Text style={{ fontSize: 20, fontWeight: 'bold', marginTop: 10 }}>Planned Activity</Text>
              <View style={{ padding: 10 }} />
              <Text
                style={{ color: 'blue', ...styles.centeredText }}
                onPress={() => proceedToEditOffer(credentialSubject) }
              >
                Offer help with this activity
              </Text>
              <View style={{ padding: 10 }} />
            </View>
          :
            <View />
          }
          {/* end actions on plans */}

          {/*----------------------------------------------------------------*/}
          <View style={styles.line} />

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
              visibleIdList.map(did =>
                <Text key={did} selectable={true}>* { utility.didInfo(did, identifiers, allContacts) }</Text>
              )
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
              visibleTo.map(did =>
                <Text key={did} style={{ color: 'blue', fontSize: 11 }} selectable={true}
                      onPress={() => setDidForVisibleModal(did)}
                >
                  * {did}
                </Text>
              )
            }
          </View>
          {
            endorserId && (visibleIdList.length > 0 || visibleTo.length > 0)
            ? <View style={{ padding: 5 }}>
                <Text>
                    To get more details, send this claim ID to one of those people and ask them
                    &nbsp;to search for more information:
                </Text>
                <Text style={{ padding: 10 }} selectable={true}>{ endorserId }</Text>
              </View>
            : <View />
          }


          {/* Now show number hidden. */}
          <View style={{ padding: 5 }}>
            <Text>
              { 'There are ' + (numHidden > 0 ? 'confirmations by ' + numHidden : 'no confirmations by anyone')
                + ' outside your network.' }
            </Text>
          </View>


          <View style={{ padding: 5 }}>
            <Text>{ confirmError }</Text>
          </View>


          <Text style={{ fontSize: 20, fontWeight: 'bold', marginTop: 20 }}>Validity</Text>
          {
            veriCredObject
            ? (
              <View>
                <View style={{ flex: 1, flexDirection: 'row' }}>
                  <Text style={{ width: '30%' }}>Issuer</Text>
                  <Text style={{ width: '70%' }} selectable={true}>
                    { utility.didInfo(issuer, identifiers, allContacts) }
                  </Text>
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
          <View style={{ padding: 5 }}>
            <Text>{ verifyError }</Text>
          </View>

          <VisibleDidModal didForVisibility={didForVisibleModal} setDidForVisibility={setDidForVisibleModal} />

          <View style={{ height: 0.8, width: "100%", backgroundColor: "#000000", marginTop: 200, marginBottom: 100 }} />
          <Text style={{ fontSize: 20, fontWeight: 'bold' }}>Details</Text>
          {
            endorserId != null
            ? <View><Text>ID on Server</Text><Text selectable={true}>{endorserId}</Text></View>
            : <View />
          }
          <Text selectable={true}>{ veriCredObject ? JSON.stringify(veriCredObject) : '' }</Text>
          <Text selectable={true}>{ wrappedClaim ? JSON.stringify(wrappedClaim) : '' }</Text>

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
      </ScrollView>
    </SafeAreaView>
  )
}

const id32_444Carpentry = '{"credentialSubject":{"@context":"https://schema.org","@type":"Person","name":"Person","identifier":"did:ethr:0x444D276f087158212d9aA4B6c85C28b9F7994AAC","knowsAbout":"carpentry"},"issuer":{"id":"did:ethr:0x444D276f087158212d9aA4B6c85C28b9F7994AAC"},"id":"http://127.0.0.1:3000/api/claim/32","type":["VerifiableCredential"],"@context":["https://www.w3.org/2018/credentials/v1"],"issuanceDate":"2021-05-09T01:31:23.000Z","proof":{"type":"JwtProof2020","jwt":"eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NksifQ.eyJ2YyI6eyJjcmVkZW50aWFsU3ViamVjdCI6eyJAY29udGV4dCI6Imh0dHA6Ly9zY2hlbWEub3JnIiwiQHR5cGUiOiJQZXJzb24iLCJuYW1lIjoiUGVyc29uIiwiaWRlbnRpZmllciI6ImRpZDpldGhyOjB4NDQ0RDI3NmYwODcxNTgyMTJkOWFBNEI2Yzg1QzI4YjlGNzk5NEFBQyIsImtub3dzQWJvdXQiOiJjYXJwZW50cnkifSwiQGNvbnRleHQiOlsiaHR0cHM6Ly93d3cudzMub3JnLzIwMTgvY3JlZGVudGlhbHMvdjEiXSwidHlwZSI6WyJWZXJpZmlhYmxlQ3JlZGVudGlhbCJdfSwianRpIjoiaHR0cDovLzE5Mi4xNjguMS41OjMwMDAvYXBpL2NsYWltLzMxIiwibmJmIjoxNjIwNTIzODgzLCJpc3MiOiJkaWQ6ZXRocjoweDQ0NEQyNzZmMDg3MTU4MjEyZDlhQTRCNmM4NUMyOGI5Rjc5OTRBQUMifQ.Dt7YSHYsgTAzgAL3z-DVMsLGAo0Np1LQZeabrREgoD190htbsh9m8bUjtWE1qDvXnsc6iv49ZlUXEpodYXhQkA"}}'

const id19_333Pres = '{"credentialSubject":{"@context":"https://schema.org","@type":"Organization","name":"Cottonwood Cryptography Club","member":{"@type":"OrganizationRole","member":{"@type":"Person","identifier":"did:ethr:0x3334FE5a696151dc4D0D03Ff3FbAa2B60568E06a"},"roleName":"President","startDate":"2019-04-01","endDate":"2020-03-31"}},"issuer":{"id":"did:ethr:0x3334FE5a696151dc4D0D03Ff3FbAa2B60568E06a"},"id":"http://127.0.0.1:3000/api/claim/19","type":["VerifiableCredential"],"@context":["https://www.w3.org/2018/credentials/v1"],"issuanceDate":"2021-05-08T21:21:27.000Z","proof":{"type":"JwtProof2020","jwt":"eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NksifQ.eyJ2YyI6eyJjcmVkZW50aWFsU3ViamVjdCI6eyJAY29udGV4dCI6Imh0dHA6Ly9zY2hlbWEub3JnIiwiQHR5cGUiOiJPcmdhbml6YXRpb24iLCJuYW1lIjoiQ290dG9ud29vZCBDcnlwdG9ncmFwaHkgQ2x1YiIsIm1lbWJlciI6eyJAdHlwZSI6Ik9yZ2FuaXphdGlvblJvbGUiLCJtZW1iZXIiOnsiQHR5cGUiOiJQZXJzb24iLCJpZGVudGlmaWVyIjoiZGlkOmV0aHI6MHgzMzM0RkU1YTY5NjE1MWRjNEQwRDAzRmYzRmJBYTJCNjA1NjhFMDZhIn0sInJvbGVOYW1lIjoiUHJlc2lkZW50Iiwic3RhcnREYXRlIjoiMjAxOS0wNC0wMSIsImVuZERhdGUiOiIyMDIwLTAzLTMxIn19LCJAY29udGV4dCI6WyJodHRwczovL3d3dy53My5vcmcvMjAxOC9jcmVkZW50aWFscy92MSJdLCJ0eXBlIjpbIlZlcmlmaWFibGVDcmVkZW50aWFsIl19LCJqdGkiOiJodHRwOi8vMTkyLjE2OC4xLjU6MzAwMC9hcGkvY2xhaW0vMTkiLCJuYmYiOjE2MjA1MDg4ODcsImlzcyI6ImRpZDpldGhyOjB4MzMzNEZFNWE2OTYxNTFkYzREMEQwM0ZmM0ZiQWEyQjYwNTY4RTA2YSJ9.rHD5ideZ4G5eWaUmQd6BAZZHXm1YIn0aUe9MSFP9uw9o88rHaWBmsHwi8MTBVs6_ALlRcZJLr8RTvGYM205FgA"}}'

const id19_333Pres_part1 = '{"credentialSubject":{"@context":"https://schema.org","@type":"Organization","name":"Cottonwood Cryptography Club","member":{"@type":"OrganizationRole","member":{"@type":"Person","identifier":"did:ethr:0x3334FE5a696151dc4D0D03Ff3FbAa2B60568E06a"},"roleName":"President","startDate":"2019-04-01","endDate":"2020-03-31"}},"issuer":{"id":"did:ethr:0x3334FE5a696151dc4D0D03Ff3FbAa2B60568E06a"},"id":"http://127.0.0.1:3000/api/claim/19","type":["VerifiableCredential"],"@context":["https://www.w3.org/2018/credentials/v1"],"issuanceDate":"2021-05-08T21:21:27.000Z","proof":{"type":"JwtProof2020","jwt":"eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NksifQ.eyJ2YyI6eyJjcmVkZW50aWFsU3ViamVjdCI6eyJAY29udGV4dCI6Imh0dHA6Ly9zY2hlbWEub3JnIiwiQHR5cGUiOiJPcmdhbml6YXRpb24iLCJuYW1lIjoiQ290dG9ud29vZCBDcnlwdG9ncmFwaHkgQ2x1YiIsIm1lbWJlciI6eyJAdHlwZSI6Ik9yZ2FuaXphdGlvblJvbGUiLCJtZW1iZXIiOnsiQHR5cGUiOiJQZXJzb24iLCJpZGVudGlmaWVyIjoiZGlkOmV0aHI6MHgzMzM0RkU1YTY5NjE1MWRjNEQwRDAzRmYzRmJBYTJCNjA1NjhFMDZhIn0sInJvbGVOYW1lIjoiUHJlc2lkZW5'

const id19_333Pres_part2 = '0Iiwic3RhcnREYXRlIjoiMjAxOS0wNC0wMSIsImVuZERhdGUiOiIyMDIwLTAzLTMxIn19LCJAY29udGV4dCI6WyJodHRwczovL3d3dy53My5vcmcvMjAxOC9jcmVkZW50aWFscy92MSJdLCJ0eXBlIjpbIlZlcmlmaWFibGVDcmVkZW50aWFsIl19LCJqdGkiOiJodHRwOi8vMTkyLjE2OC4xLjU6MzAwMC9hcGkvY2xhaW0vMTkiLCJuYmYiOjE2MjA1MDg4ODcsImlzcyI6ImRpZDpldGhyOjB4MzMzNEZFNWE2OTYxNTFkYzREMEQwM0ZmM0ZiQWEyQjYwNTY4RTA2YSJ9.rHD5ideZ4G5eWaUmQd6BAZZHXm1YIn0aUe9MSFP9uw9o88rHaWBmsHwi8MTBVs6_ALlRcZJLr8RTvGYM205FgA"}}'

const id28_777Carpentry = '{"credentialSubject":{"@context":"https://schema.org","@type":"Person","name":"Person","identifier":"did:ethr:0x777cd7E7761b53EFEEF01E8c7F8F0461b0a2DAdc","knowsAbout":"carpentry"},"issuer":{"id":"did:ethr:0x777cd7E7761b53EFEEF01E8c7F8F0461b0a2DAdc"},"id":"http://127.0.0.1:3000/api/claim/28","type":["VerifiableCredential"],"@context":["https://www.w3.org/2018/credentials/v1"],"issuanceDate":"2021-05-09T16:17:43.000Z","proof":{"type":"JwtProof2020","jwt":"eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NksifQ.eyJ2YyI6eyJjcmVkZW50aWFsU3ViamVjdCI6eyJAY29udGV4dCI6Imh0dHA6Ly9zY2hlbWEub3JnIiwiQHR5cGUiOiJQZXJzb24iLCJuYW1lIjoiUGVyc29uIiwiaWRlbnRpZmllciI6ImRpZDpldGhyOjB4Nzc3Y2Q3RTc3NjFiNTNFRkVFRjAxRThjN0Y4RjA0NjFiMGEyREFkYyIsImtub3dzQWJvdXQiOiJjYXJwZW50cnkifSwiQGNvbnRleHQiOlsiaHR0cHM6Ly93d3cudzMub3JnLzIwMTgvY3JlZGVudGlhbHMvdjEiXSwidHlwZSI6WyJWZXJpZmlhYmxlQ3JlZGVudGlhbCJdfSwianRpIjoiaHR0cDovLzE5Mi4xNjguMS41OjMwMDAvYXBpL2NsYWltLzI4IiwibmJmIjoxNjIwNTc3MDYzLCJpc3MiOiJkaWQ6ZXRocjoweDc3N2NkN0U3NzYxYjUzRUZFRUYwMUU4YzdGOEYwNDYxYjBhMkRBZGMifQ.VgGG2BDu40GHvpPxCLGjeDUu1SiJV_0n6TPormPdVThbluatKpZn8g3lPU1XbFsRGsqnGAZVZ18qz2y6FLVyoQ"}}'

const id28_777Bad = '{"credentialSubject":{"@context":"https://schema.org","@type":"Person","name":"Person","identifier":"did:ethr:0x777cd7E7761b53EFEEF01E8c7F8F0461b0a2DAdc","knowsAbout":"carpentry"},"issuer":{"id":"did:ethr:0x777cd7E7761b53EFEEF01E8c7F8F0461b0a2DAdc"},"id":"http://127.0.0.1:3000/api/claim/28","type":["VerifiableCredential"],"@context":["https://www.w3.org/2018/credentials/v1"],"issuanceDate":"2020-05-09T16:17:43.000Z","proof":{"type":"JwtProof2020","jwt":"eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NksifQ.eyJ2YyI6eyJjcmVkZW50aWFsU3ViamVjdCI6eyJAY29udGV4dCI6Imh0dHA6Ly9zY2hlbWEub3JnIiwiQHR5cGUiOiJQZXJzb24iLCJuYW1lIjoiUGVyc29uIiwiaWRlbnRpZmllciI6ImRpZDpldGhyOjB4Nzc3Y2Q3RTc3NjFiNTNFRkVFRjAxRThjN0Y4RjA0NjFiMGEyREFkYyIsImtub3dzQWJvdXQiOiJjYXJwZW50cnkifSwiQGNvbnRleHQiOlsiaHR0cHM6Ly93d3cudzMub3JnLzIwMTgvY3JlZGVudGlhbHMvdjEiXSwidHlwZSI6WyJWZXJpZmlhYmxlQ3JlZGVudGlhbCJdfSwianRpIjoiaHR0cDovLzE5Mi4xNjguMS41OjMwMDAvYXBpL2NsYWltLzI4IiwibmJmIjoxNjIwNTc3MDYzLCJpc3MiOiJkaWQ6ZXRocjoweDc3N2NkN0U3NzYxYjUzRUZFRUYwMUU4YzdGOEYwNDYxYjBhMkRBZGMifQ.rHD5ideZ4G5eWaUmQd6BAZZHXm1YIn0aUe9MSFP9uw9o88rHaWBmsHwi8MTBVs6_ALlRcZJLr8RTvGYM205FgA"}}'
