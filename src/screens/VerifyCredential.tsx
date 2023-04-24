import didJwt from 'did-jwt'
import { DateTime } from 'luxon'
import * as R from 'ramda'
import React, { useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  SafeAreaView,
  ScrollView,
  Text,
  TouchableHighlight,
  View
} from "react-native";
import Clipboard from '@react-native-community/clipboard'
import QRCode from "react-native-qrcode-svg"
import Icon from 'react-native-vector-icons/FontAwesome'
import { useFocusEffect } from '@react-navigation/native'
import { useSelector } from 'react-redux'

import { styles } from './style'
import { PrivateData } from '../entity/privateData'
import * as utility from '../utility/utility'
import { proceedToEditGive, proceedToEditOffer, VisibleDidModal, YamlFormat } from "../utility/utility.tsx";
import { appSlice, appStore } from '../veramo/appSlice'
import { dbConnection, DEFAULT_BASIC_RESOLVER } from '../veramo/setup'

export function VerifyCredentialScreen({ navigation, route }) {

  // Only one of the following is expected:
  // - veriCred is Verified Credential
  // - wrappedClaim is directly from Endorser server (a utility.EndorserRecord),
  //   typically from previous search results
  const { veriCred, wrappedClaim } = route.params

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
  const [loadingVer, setLoadingVer] = useState<boolean>(true)
  const [loadingTotals, setLoadingTotals] = useState<boolean>(false)
  const [numHidden, setNumHidden] = useState<number>(0)
  const [planOfferTotals, setPlanOfferTotals] = useState<Record<string, number>>({})
  const [planGiveTotals, setPlanGiveTotals] = useState<Record<string, number>>({})
  const [quickMessage, setQuickMessage] = useState<string>(null)
  const [showInfoConsistency, setShowInfoConsistency] = useState<boolean>(false)
  const [showMyQr, setShowMyQr] = useState<boolean>(false)
  const [totalsError, setTotalsError] = useState<string>('')
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

  useFocusEffect(
    React.useCallback(() => {
      async function verifyAll() {

        // This is what we'll show as the full verifiable credential.
        // If from the server (from a wrappedClaim) then it's constructed from those pieces.
        let vcObj = veriCred

        setLoadingVer(true)
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
              "Authorization": "Bearer " + userToken
            }})
            .then(async response => {
              if (response.status === 200) {
                return response.json()
              } else {
                const text = await response.text()
                let userMessage =
                  'While retrieving full claim, got bad response status of ' + response.status
                  + ' with text ' + text
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
                  issuer: result.issuer,
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

            const issueEpoch = Math.floor(new Date(vcObj.issuanceDate).getTime() / 1000)
            const nowEpoch = Math.floor(Date.now() / 1000)
            const skewTime = nowEpoch - issueEpoch

            verifiedResponse = await didJwt.verifyJWT(
              vcObj.proof.jwt,
              {resolver: DEFAULT_BASIC_RESOLVER, auth: true, skewTime: skewTime }
            )

            // if we're here, it must have passed validation
            setDetectedSigValid(true)

          } catch (e) {
            if (e.toString().indexOf('Signature invalid for JWT') > -1) {
              setDetectedSigInvalid(true)
            } else if (e.toString().indexOf('JWT has expired') > -1) {
              setDetectedSigProblem(true)
              appStore.dispatch(appSlice.actions.addLog({
                log: true,
                msg:
                  "Got expiration error verifying JWT, even with skewTime: "
                  + JSON.stringify(e)
              }))
            } else {
              setDetectedSigProblem(true)
              appStore.dispatch(appSlice.actions.addLog({
                log: true,
                msg: "Got unknown error verifying JWT: " + JSON.stringify(e)
              }))
            }
          }
        }

        if (verifiedResponse) {

          // check that the contents inside and outside the JWT match
          const verSub =
            verifiedResponse.payload.vc?.credentialSubject
            || verifiedResponse.payload.claim // still happening; saw in Plan
          if (verSub) {
            setCredentialSubject(verSub)
            if (vcObj.credentialSubject) {
              setCredentialSubjectsMatch(
                R.equals(vcObj.credentialSubject, verSub)
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
        } else {
          // no verified response, so let's guess at other places
          setCredentialSubject(vcObj.credentialSubject)
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
                "Authorization": "Bearer " + userToken
              }})
              .then(async response => {
                if (response.status === 200) {
                  return response.json()
                } else {
                  const text = await response.text()
                  let userMessage =
                    'While retrieving confirmations, got bad response status of ' + response.status
                    + ' with text ' + text
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
        setLoadingVer(false)
      }

      verifyAll()

    }, [])
  )

  // also load totals if this is a plan
  useFocusEffect(
    React.useCallback(() => {
      async function loadTotals() {
        setLoadingTotals(true)

        const url =
          appStore.getState().settings.apiServer
          + '/api/v2/report/giveTotals?planId='
          + encodeURIComponent(wrappedClaim.handleId)
        const userToken = await utility.accessToken(identifiers[0])
        await fetch(url, {
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + userToken
          }
        })
        .then(async response => {
          if (response.status === 200) {
            return response.json()
          } else {
            const text = await response.text()
            throw 'Got from server: ' + text
          }
        })
        .then(data => {
          setPlanGiveTotals(data.data)
        })
        .catch(err =>
          setTotalsError('Got error loading given totals: ' + err)
        )

        const url2 =
          appStore.getState().settings.apiServer
          + '/api/v2/report/offerTotals?planId='
          + encodeURIComponent(wrappedClaim.handleId)
        const userToken2 = await utility.accessToken(identifiers[0])
        await fetch(url2, {
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + userToken2
          }
        })
        .then(async response => {
          if (response.status === 200) {
            return response.json()
          } else {
            const text = await response.text()
            throw 'Got from server: ' + text
          }
        })
        .then(data => {
          setPlanOfferTotals(data.data)
        })
        .catch(err =>
          setTotalsError('Got error loading offered totals: ' + err)
        )

        setLoadingTotals(false)
      }

      if (wrappedClaim?.claimType === 'PlanAction') {
        loadTotals()
      }
    }, [])
  )

  return (
    <SafeAreaView>
      <ScrollView>
        <View style={{ padding: 20 }}>
          <Text style={{ fontSize: 30, fontWeight: 'bold' }}>Details</Text>
          {
            loadingVer
            ? <ActivityIndicator color="#00FF00" />
            : <View style={{ padding: 10 }}/>
          }
          <Text style={{ fontSize: 20, fontWeight: 'bold', marginTop: 20 }}>Claim</Text>
          {
            credentialSubject
            ? <YamlFormat source={credentialSubject} navigation={navigation} />
            : <Text>{ loadingVer ? "" : "No claim data available." }</Text>
          }


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
              <Text style={{ fontSize: 20, fontWeight: 'bold', marginTop: 10 }}>
                Planned Activity
              </Text>
              <View style={{ padding: 10 }} />
              <Text
                style={{ color: 'blue', ...styles.centeredText }}
                onPress={() =>
                  proceedToEditGive(navigation, credentialSubject, wrappedClaim?.handleId)
                }
              >
                Record help given to this
              </Text>
              <View style={{ padding: 10 }} />
              <Text
                style={{ color: 'blue', ...styles.centeredText }}
                onPress={() =>
                  proceedToEditOffer(navigation, credentialSubject, wrappedClaim?.handleId)
                }
              >
                Offer help with this
              </Text>

              <Text style={{ fontWeight: 'bold' }}>Give Totals</Text>
              {/* These currency-amount lists should be small. */}
              {
                loadingTotals
                ? <ActivityIndicator color="#00FF00" />
                :
                  R.isEmpty(planGiveTotals)
                  ?
                    <Text>None</Text>
                  :
                    R.keys(planGiveTotals).map(key =>
                      <Text key={ key }>
                        { utility.displayAmount(key, planGiveTotals[key]) }
                      </Text>
                    )
              }

              <Text style={{ fontWeight: 'bold', marginTop: 10 }}>Offer Totals</Text>
              {/* These currency-amount lists should be small. */}
              {
                loadingTotals
                ? <ActivityIndicator color="#00FF00" />
                :
                  R.isEmpty(planOfferTotals)
                  ?
                    <Text>None</Text>
                  :
                    R.keys(planOfferTotals).map(key =>
                      <Text key={ key }>
                        { utility.displayAmount(key, planOfferTotals[key]) }
                      </Text>
                    )
              }

              <Text style={{ color: 'red' }}>{ totalsError }</Text>

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
            loadingVer
            ? <ActivityIndicator color="#00FF00" />
            : <View style={{ padding: 10 }}/>
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
                      <Text style={{ width: '30%' }}>
                        Consistent?
                        &nbsp;
                        <Icon name="info-circle" onPress={() => setShowInfoConsistency(true)} />
                      </Text>
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
            endorserId
            ? <View>
                <Text>ID on Server:</Text>
                <Text selectable={true}>{endorserId}</Text>
              </View>
            : <View />
          }
          {
            veriCredObject
            ? <View>
                <Text>Verified:</Text>
                <Text selectable={true}>{ JSON.stringify(veriCredObject) }</Text>
              </View>
            : <View />
          }
          {
            wrappedClaim
            ? <View>
                <Text>Entry:</Text>
                <Text selectable={true}>{ JSON.stringify(wrappedClaim) }</Text>
              </View>
            : <View />
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

          <Modal
            animationType="slide"
            transparent={true}
            visible={!!showInfoConsistency}
          >
            <View style={styles.centeredView}>
              <View style={styles.modalView}>
                <Text>
                  This is consistent if there is a payload and a signature and they match.
                </Text>
                <TouchableHighlight
                  onPress={() => { setShowInfoConsistency(false) }}
                  style={styles.cancelButton}
                >
                  <Text>Close</Text>
                </TouchableHighlight>
              </View>
            </View>
          </Modal>

        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
