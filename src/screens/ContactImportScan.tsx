import React from 'react'
import { Button, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useCameraDevices } from 'react-native-vision-camera';
import { Camera } from 'react-native-vision-camera';
import { useScanBarcodes, BarcodeFormat } from 'vision-camera-code-scanner';

import { appSlice, appStore } from '../veramo/appSlice'
import * as utility from '../utility/utility'

export function ContactImportScreen({ navigation }) {

  const CURRENT_JWT_PREFIX = appStore.getState().viewServer + utility.ENDORSER_JWT_URL_LOCATION

  const devices = useCameraDevices()
  const device = devices.back

  const [hasPermission, setHasPermission] = React.useState(false)
  const [frameProcessor, barcodes] = useScanBarcodes([BarcodeFormat.QR_CODE], {
    checkInverted: true,
  })

  const onSuccessfulQrEvent = async (e) => {
    navigation.navigate('Contacts', { scannedDatum: e.data })
  }

  const checkPermissions = async () => {
    const status = await Camera.requestCameraPermission()
    console.log('Camera permission status:', status)
    setHasPermission(status === 'authorized');
  }

  React.useEffect(() => {
    checkPermissions()
  }, []);

  React.useEffect(() => {
    barcodes.map((barcode, idx) => (
      console.log("Scanned:", barcode.displayValue)
    ))
  }, [barcodes]);

  return (
    <SafeAreaView>
      <ScrollView>
        <View style={{ padding: 20 }}>
          <Text style={{ fontSize: 30, fontWeight: 'bold' }}>Import Contact</Text>

          <View>
            { device == null
              ? (
                <Text>No camera detected.</Text>
              ) : (
                !hasPermission
                ? (
                  <View>
                    <Text>This app does not have camera permissions.</Text>
                    <Button
                      title="Check Permissions"
                      onPress={checkPermissions}
                    />
                  </View>
                ) : (
                  <View>
                    <Camera
                      style={StyleSheet.absoluteFill}
                      device={device}
                      isActive={true}
                      frameProcessor={frameProcessor}
                      frameProcessorFps={5}
                    />
                    {barcodes.map((barcode, idx) => (
                      <Text key={idx}>
                          {barcode.displayValue}
                      </Text>
                    ))}
                  </View>
                )
              )
            }
            { appStore.getState().testMode
              ?
                <View>
                  <Button
                    title='Fake Singleton'
                    onPress={() => barcodes.push({ displayValue: CURRENT_JWT_PREFIX + "eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NksifQ.eyJpYXQiOjE2MTUyNjMwODc3OTMsImlzcyI6ImRpZDpldGhyOjB4M2YyMDVFMTgwOGU4NWVDREFmYTU0MGYyZEE1N0JkQzhkOWQyZDUxRCIsIm93biI6eyJuYW1lIjoiU3R1ZmYiLCJwdWJsaWNFbmNLZXkiOiJnM1oxbUpzSDlzRVVXM1ZremtXb2tZenlKRUdGUUFidG9QcnFqT0s3RWs0PSJ9fQ.h27enm55_0Bd06UJHAQWRmULwidOOhHNe2reqjYTAcVJvQ0aUTCEmP88HlJcZ3bUa-VbrXT76sqV6i19bQZ_PA" })}
                  />
                  <Button
                    title='Fake Singleton Too'
                    onPress={() => navigation.navigate('Contacts', { scannedDatum: CURRENT_JWT_PREFIX + "eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NksifQ.eyJpYXQiOjE2MTUyNjMwODc3OTMsImlzcyI6ImRpZDpldGhyOjB4N3ZyMDVFMTgwOGU4NWVDREFmYTU0MGYyZEE1N0JkQzhkOWQyZDUxRCIsIm93biI6eyJuYW1lIjoiN3R1ZmYiLCJwdWJsaWNFbmNLZXkiOiJNN1oxbUpzSDlzRVVXM1ZremtXb2tZenlKRUdGUUFidG9QcnFqT0s3RWs0PSJ9fQ.h27enm55_0Bd06UJHAQWRmULwidOOhHNe2reqjYTAcVJvQ0aUTCEmP88HlJcZ3bUa-VbrXT76sqV6i19bQZ_PA" })}
                  />
                  <Button
                    title='Fake 127.0.0.1:8080/test.csv'
                    onPress={() => navigation.navigate('Contacts', { scannedDatum: "http://127.0.0.1:8080/test.csv" })}
                  />
                </View>
              :
                <View />
            }
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
