import React, { useState } from 'react'
import {
  Button,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View
} from "react-native";
import { CheckBox } from 'react-native-elements'
import QRCodeScanner from 'react-native-qrcode-scanner'
import QRCode from "react-native-qrcode-svg"
import { appStore } from '../veramo/appSlice'

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
      && lastChar != '}' /* This is just in case we're really at the end */) {
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
          // probably not at the end
        }
        if (parseSucceeded) {
          navigation.replace('Verify Presentation', { veriPresStr: allScanned })
        }
      } else {
        navigation.replace('Verify Presentation', { veriPresStr: allScanned })
      }
    }
  }

  return (
    <SafeAreaView>
      <ScrollView>
        <View style={{ padding: 20 }}>

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

          <View style={{ flexDirection: 'row', marginLeft: 20 }}>
            <Text>... or paste:</Text>
            <TextInput
              onChange={e => {
                onSuccessfulQrText(e.nativeEvent.text)
              }}
              style={{ borderWidth: 1, width: 200 }}
            />
          </View>

          { appStore.getState().testMode
            ? <View>
              <Button
                title='Fake 333 Cred'
                onPress={() => onSuccessfulQrText(id19_333Cred)}
              />
              <Button
                title='Fake 333 Cred - Part 1'
                onPress={() => onSuccessfulQrText(id19_333Cred_part1)}
              />
              <Button
                title='Fake 333 Cred - Part 2'
                onPress={() => onSuccessfulQrText(id19_333Cred_part2)}
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
                title='Fake 777 Carpentry X 2'
                onPress={() => onSuccessfulQrText(id28_777CarpentryX2)}
              />
              <Button
                title='Fake & Invalid 777'
                onPress={() => onSuccessfulQrText(id28_777Bad)}
              />
              <QRCode value={id19_333Cred} size={300} />
            </View>
            : <View/>
          }
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const id32_444Carpentry = '{"iat":"16817161514", "verifiableCredential": [{"credentialSubject":{"@context":"https://schema.org","@type":"Person","name":"Person","identifier":"did:ethr:0x444D276f087158212d9aA4B6c85C28b9F7994AAC","knowsAbout":"carpentry"},"issuer":{"id":"did:ethr:0x444D276f087158212d9aA4B6c85C28b9F7994AAC"},"id":"http://127.0.0.1:3000/api/claim/32","type":["VerifiableCredential"],"@context":["https://www.w3.org/2018/credentials/v1"],"issuanceDate":"2021-05-09T01:31:23.000Z","proof":{"type":"JwtProof2020","jwt":"eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NksifQ.eyJ2YyI6eyJjcmVkZW50aWFsU3ViamVjdCI6eyJAY29udGV4dCI6Imh0dHA6Ly9zY2hlbWEub3JnIiwiQHR5cGUiOiJQZXJzb24iLCJuYW1lIjoiUGVyc29uIiwiaWRlbnRpZmllciI6ImRpZDpldGhyOjB4NDQ0RDI3NmYwODcxNTgyMTJkOWFBNEI2Yzg1QzI4YjlGNzk5NEFBQyIsImtub3dzQWJvdXQiOiJjYXJwZW50cnkifSwiQGNvbnRleHQiOlsiaHR0cHM6Ly93d3cudzMub3JnLzIwMTgvY3JlZGVudGlhbHMvdjEiXSwidHlwZSI6WyJWZXJpZmlhYmxlQ3JlZGVudGlhbCJdfSwianRpIjoiaHR0cDovLzE5Mi4xNjguMS41OjMwMDAvYXBpL2NsYWltLzMxIiwibmJmIjoxNjIwNTIzODgzLCJpc3MiOiJkaWQ6ZXRocjoweDQ0NEQyNzZmMDg3MTU4MjEyZDlhQTRCNmM4NUMyOGI5Rjc5OTRBQUMifQ.Dt7YSHYsgTAzgAL3z-DVMsLGAo0Np1LQZeabrREgoD190htbsh9m8bUjtWE1qDvXnsc6iv49ZlUXEpodYXhQkA"}}]}'

const id19_333Cred = '{"iat":"16817161514", "verifiableCredential": [{"credentialSubject":{"@context":"https://schema.org","@type":"Organization","name":"Cottonwood Cryptography Club","member":{"@type":"OrganizationRole","member":{"@type":"Person","identifier":"did:ethr:0x3334FE5a696151dc4D0D03Ff3FbAa2B60568E06a"},"roleName":"President","startDate":"2019-04-01","endDate":"2020-03-31"}},"issuer":{"id":"did:ethr:0x3334FE5a696151dc4D0D03Ff3FbAa2B60568E06a"},"id":"http://127.0.0.1:3000/api/claim/19","type":["VerifiableCredential"],"@context":["https://www.w3.org/2018/credentials/v1"],"issuanceDate":"2021-05-08T21:21:27.000Z","proof":{"type":"JwtProof2020","jwt":"eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NksifQ.eyJ2YyI6eyJjcmVkZW50aWFsU3ViamVjdCI6eyJAY29udGV4dCI6Imh0dHA6Ly9zY2hlbWEub3JnIiwiQHR5cGUiOiJPcmdhbml6YXRpb24iLCJuYW1lIjoiQ290dG9ud29vZCBDcnlwdG9ncmFwaHkgQ2x1YiIsIm1lbWJlciI6eyJAdHlwZSI6Ik9yZ2FuaXphdGlvblJvbGUiLCJtZW1iZXIiOnsiQHR5cGUiOiJQZXJzb24iLCJpZGVudGlmaWVyIjoiZGlkOmV0aHI6MHgzMzM0RkU1YTY5NjE1MWRjNEQwRDAzRmYzRmJBYTJCNjA1NjhFMDZhIn0sInJvbGVOYW1lIjoiUHJlc2lkZW50Iiwic3RhcnREYXRlIjoiMjAxOS0wNC0wMSIsImVuZERhdGUiOiIyMDIwLTAzLTMxIn19LCJAY29udGV4dCI6WyJodHRwczovL3d3dy53My5vcmcvMjAxOC9jcmVkZW50aWFscy92MSJdLCJ0eXBlIjpbIlZlcmlmaWFibGVDcmVkZW50aWFsIl19LCJqdGkiOiJodHRwOi8vMTkyLjE2OC4xLjU6MzAwMC9hcGkvY2xhaW0vMTkiLCJuYmYiOjE2MjA1MDg4ODcsImlzcyI6ImRpZDpldGhyOjB4MzMzNEZFNWE2OTYxNTFkYzREMEQwM0ZmM0ZiQWEyQjYwNTY4RTA2YSJ9.rHD5ideZ4G5eWaUmQd6BAZZHXm1YIn0aUe9MSFP9uw9o88rHaWBmsHwi8MTBVs6_ALlRcZJLr8RTvGYM205FgA"}}]}'

const id19_333Cred_part1 = '{"iat":"16817161514", "verifiableCredential": [{"credentialSubject":{"@context":"https://schema.org","@type":"Organization","name":"Cottonwood Cryptography Club","member":{"@type":"OrganizationRole","member":{"@type":"Person","identifier":"did:ethr:0x3334FE5a696151dc4D0D03Ff3FbAa2B60568E06a"},"roleName":"President","startDate":"2019-04-01","endDate":"2020-03-31"}},"issuer":{"id":"did:ethr:0x3334FE5a696151dc4D0D03Ff3FbAa2B60568E06a"},"id":"http://127.0.0.1:3000/api/claim/19","type":["VerifiableCredential"],"@context":["https://www.w3.org/2018/credentials/v1"],"issuanceDate":"2021-05-08T21:21:27.000Z","proof":{"type":"JwtProof2020","jwt":"eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NksifQ.eyJ2YyI6eyJjcmVkZW50aWFsU3ViamVjdCI6eyJAY29udGV4dCI6Imh0dHA6Ly9zY2hlbWEub3JnIiwiQHR5cGUiOiJPcmdhbml6YXRpb24iLCJuYW1lIjoiQ290dG9ud29vZCBDcnlwdG9ncmFwaHkgQ2x1YiIsIm1lbWJlciI6eyJAdHlwZSI6Ik9yZ2FuaXphdGlvblJvbGUiLCJtZW1iZXIiOnsiQHR5cGUiOiJQZXJzb24iLCJpZGVudGlmaWVyIjoiZGlkOmV0aHI6MHgzMzM0RkU1YTY5NjE1MWRjNEQwRDAzRmYzRmJBYTJCNjA1NjhFMDZhIn0sInJvbGVOYW1lIjoiUHJlc2lkZW5'

const id19_333Cred_part2 = '0Iiwic3RhcnREYXRlIjoiMjAxOS0wNC0wMSIsImVuZERhdGUiOiIyMDIwLTAzLTMxIn19LCJAY29udGV4dCI6WyJodHRwczovL3d3dy53My5vcmcvMjAxOC9jcmVkZW50aWFscy92MSJdLCJ0eXBlIjpbIlZlcmlmaWFibGVDcmVkZW50aWFsIl19LCJqdGkiOiJodHRwOi8vMTkyLjE2OC4xLjU6MzAwMC9hcGkvY2xhaW0vMTkiLCJuYmYiOjE2MjA1MDg4ODcsImlzcyI6ImRpZDpldGhyOjB4MzMzNEZFNWE2OTYxNTFkYzREMEQwM0ZmM0ZiQWEyQjYwNTY4RTA2YSJ9.rHD5ideZ4G5eWaUmQd6BAZZHXm1YIn0aUe9MSFP9uw9o88rHaWBmsHwi8MTBVs6_ALlRcZJLr8RTvGYM205FgA"}}]}'

const id28_777Carpentry = '{"iat":"16817161514", "verifiableCredential": [{"credentialSubject":{"@context":"https://schema.org","@type":"Person","name":"Person","identifier":"did:ethr:0x777cd7E7761b53EFEEF01E8c7F8F0461b0a2DAdc","knowsAbout":"carpentry"},"issuer":{"id":"did:ethr:0x777cd7E7761b53EFEEF01E8c7F8F0461b0a2DAdc"},"id":"http://127.0.0.1:3000/api/claim/28","type":["VerifiableCredential"],"@context":["https://www.w3.org/2018/credentials/v1"],"issuanceDate":"2021-05-09T16:17:43.000Z","proof":{"type":"JwtProof2020","jwt":"eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NksifQ.eyJ2YyI6eyJjcmVkZW50aWFsU3ViamVjdCI6eyJAY29udGV4dCI6Imh0dHA6Ly9zY2hlbWEub3JnIiwiQHR5cGUiOiJQZXJzb24iLCJuYW1lIjoiUGVyc29uIiwiaWRlbnRpZmllciI6ImRpZDpldGhyOjB4Nzc3Y2Q3RTc3NjFiNTNFRkVFRjAxRThjN0Y4RjA0NjFiMGEyREFkYyIsImtub3dzQWJvdXQiOiJjYXJwZW50cnkifSwiQGNvbnRleHQiOlsiaHR0cHM6Ly93d3cudzMub3JnLzIwMTgvY3JlZGVudGlhbHMvdjEiXSwidHlwZSI6WyJWZXJpZmlhYmxlQ3JlZGVudGlhbCJdfSwianRpIjoiaHR0cDovLzE5Mi4xNjguMS41OjMwMDAvYXBpL2NsYWltLzI4IiwibmJmIjoxNjIwNTc3MDYzLCJpc3MiOiJkaWQ6ZXRocjoweDc3N2NkN0U3NzYxYjUzRUZFRUYwMUU4YzdGOEYwNDYxYjBhMkRBZGMifQ.VgGG2BDu40GHvpPxCLGjeDUu1SiJV_0n6TPormPdVThbluatKpZn8g3lPU1XbFsRGsqnGAZVZ18qz2y6FLVyoQ"}}]}'

const id28_777CarpentryX2 = '{"iat":"16817161514", "verifiableCredential": [{"credentialSubject":{"@context":"https://schema.org","@type":"Person","name":"Person","identifier":"did:ethr:0x777cd7E7761b53EFEEF01E8c7F8F0461b0a2DAdc","knowsAbout":"carpentry"},"issuer":{"id":"did:ethr:0x777cd7E7761b53EFEEF01E8c7F8F0461b0a2DAdc"},"id":"http://127.0.0.1:3000/api/claim/28","type":["VerifiableCredential"],"@context":["https://www.w3.org/2018/credentials/v1"],"issuanceDate":"2021-05-09T16:17:43.000Z","proof":{"type":"JwtProof2020","jwt":"eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NksifQ.eyJ2YyI6eyJjcmVkZW50aWFsU3ViamVjdCI6eyJAY29udGV4dCI6Imh0dHA6Ly9zY2hlbWEub3JnIiwiQHR5cGUiOiJQZXJzb24iLCJuYW1lIjoiUGVyc29uIiwiaWRlbnRpZmllciI6ImRpZDpldGhyOjB4Nzc3Y2Q3RTc3NjFiNTNFRkVFRjAxRThjN0Y4RjA0NjFiMGEyREFkYyIsImtub3dzQWJvdXQiOiJjYXJwZW50cnkifSwiQGNvbnRleHQiOlsiaHR0cHM6Ly93d3cudzMub3JnLzIwMTgvY3JlZGVudGlhbHMvdjEiXSwidHlwZSI6WyJWZXJpZmlhYmxlQ3JlZGVudGlhbCJdfSwianRpIjoiaHR0cDovLzE5Mi4xNjguMS41OjMwMDAvYXBpL2NsYWltLzI4IiwibmJmIjoxNjIwNTc3MDYzLCJpc3MiOiJkaWQ6ZXRocjoweDc3N2NkN0U3NzYxYjUzRUZFRUYwMUU4YzdGOEYwNDYxYjBhMkRBZGMifQ.VgGG2BDu40GHvpPxCLGjeDUu1SiJV_0n6TPormPdVThbluatKpZn8g3lPU1XbFsRGsqnGAZVZ18qz2y6FLVyoQ"}}, {"credentialSubject":{"@context":"https://schema.org","@type":"Person","name":"Person","identifier":"did:ethr:0x777cd7E7761b53EFEEF01E8c7F8F0461b0a2DAdc","knowsAbout":"carpentry"},"issuer":{"id":"did:ethr:0x777cd7E7761b53EFEEF01E8c7F8F0461b0a2DAdc"},"id":"http://127.0.0.1:3000/api/claim/29","type":["VerifiableCredential"],"@context":["https://www.w3.org/2018/credentials/v1"],"issuanceDate":"2021-05-09T16:17:43.000Z","proof":{"type":"JwtProof2020","jwt":"eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NksifQ.eyJ2YyI6eyJjcmVkZW50aWFsU3ViamVjdCI6eyJAY29udGV4dCI6Imh0dHA6Ly9zY2hlbWEub3JnIiwiQHR5cGUiOiJQZXJzb24iLCJuYW1lIjoiUGVyc29uIiwiaWRlbnRpZmllciI6ImRpZDpldGhyOjB4Nzc3Y2Q3RTc3NjFiNTNFRkVFRjAxRThjN0Y4RjA0NjFiMGEyREFkYyIsImtub3dzQWJvdXQiOiJjYXJwZW50cnkifSwiQGNvbnRleHQiOlsiaHR0cHM6Ly93d3cudzMub3JnLzIwMTgvY3JlZGVudGlhbHMvdjEiXSwidHlwZSI6WyJWZXJpZmlhYmxlQ3JlZGVudGlhbCJdfSwianRpIjoiaHR0cDovLzE5Mi4xNjguMS41OjMwMDAvYXBpL2NsYWltLzI4IiwibmJmIjoxNjIwNTc3MDYzLCJpc3MiOiJkaWQ6ZXRocjoweDc3N2NkN0U3NzYxYjUzRUZFRUYwMUU4YzdGOEYwNDYxYjBhMkRBZGMifQ.VgGG2BDu40GHvpPxCLGjeDUu1SiJV_0n6TPormPdVThbluatKpZn8g3lPU1XbFsRGsqnGAZVZ18qz2y6FLVyoQ"}}]}'

const id28_777Bad = '{"iat":"16817161514", "verifiableCredential": [{"credentialSubject":{"@context":"https://schema.org","@type":"Person","name":"Person","identifier":"did:ethr:0x777cd7E7761b53EFEEF01E8c7F8F0461b0a2DAdc","knowsAbout":"carpentry"},"issuer":{"id":"did:ethr:0x777cd7E7761b53EFEEF01E8c7F8F0461b0a2DAdc"},"id":"http://127.0.0.1:3000/api/claim/28","type":["VerifiableCredential"],"@context":["https://www.w3.org/2018/credentials/v1"],"issuanceDate":"2020-05-09T16:17:43.000Z","proof":{"type":"JwtProof2020","jwt":"eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NksifQ.eyJ2YyI6eyJjcmVkZW50aWFsU3ViamVjdCI6eyJAY29udGV4dCI6Imh0dHA6Ly9zY2hlbWEub3JnIiwiQHR5cGUiOiJQZXJzb24iLCJuYW1lIjoiUGVyc29uIiwiaWRlbnRpZmllciI6ImRpZDpldGhyOjB4Nzc3Y2Q3RTc3NjFiNTNFRkVFRjAxRThjN0Y4RjA0NjFiMGEyREFkYyIsImtub3dzQWJvdXQiOiJjYXJwZW50cnkifSwiQGNvbnRleHQiOlsiaHR0cHM6Ly93d3cudzMub3JnLzIwMTgvY3JlZGVudGlhbHMvdjEiXSwidHlwZSI6WyJWZXJpZmlhYmxlQ3JlZGVudGlhbCJdfSwianRpIjoiaHR0cDovLzE5Mi4xNjguMS41OjMwMDAvYXBpL2NsYWltLzI4IiwibmJmIjoxNjIwNTc3MDYzLCJpc3MiOiJkaWQ6ZXRocjoweDc3N2NkN0U3NzYxYjUzRUZFRUYwMUU4YzdGOEYwNDYxYjBhMkRBZGMifQ.rHD5ideZ4G5eWaUmQd6BAZZHXm1YIn0aUe9MSFP9uw9o88rHaWBmsHwi8MTBVs6_ALlRcZJLr8RTvGYM205FgA"}}]}'
