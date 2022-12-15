import React from "react"
import { Button, SafeAreaView, ScrollView, Text, View } from "react-native"
import { useSelector } from 'react-redux'

import { dbConnection } from "../veramo/setup"
import { appSlice, appStore } from "../veramo/appSlice"

const logDatabaseTable = (tableName, maxId) => async () => {
  let query = 'SELECT * FROM ' + tableName
  if (maxId) {
    query += ' ORDER BY id DESC LIMIT 1'
  }
  const conn = await dbConnection
  const data = await conn.manager.query(query)
  if (tableName === 'settings') {
    data[0]['mnemEncrBase64'] = 'HIDDEN'
  }
  appStore.dispatch(appSlice.actions.addLog({log: true, msg: "\nContents of table \"" + tableName + "\":\n" + JSON.stringify(data)}))
}

export function LogsScreen({navigation}) {

  const logMessageSelector = useSelector((state) => state.logMessage)

  return (
    <SafeAreaView>
      <ScrollView>

        <Button
          title='Log Contact Table'
          onPress={logDatabaseTable('contact')}
        />
        <View style={{ marginTop: 5 }}/>
        <Button
          title='Log Identifier Table'
          onPress={logDatabaseTable('identifier')}
        />
        <View style={{ marginTop: 5 }}/>
        <Button
          title='Log Key Table'
          onPress={logDatabaseTable('key')}
        />
        <View style={{ marginTop: 5 }}/>
        <Button
          title='Log All Private Data'
          onPress={logDatabaseTable('privateData')}
        />
        <View style={{ marginTop: 5 }}/>
        <Button
          title='Log Latest Private Datum'
          onPress={logDatabaseTable('privateData', true)}
        />
        <View style={{ marginTop: 5 }}/>
        <Button
          title='Log Settings Table'
          onPress={logDatabaseTable('settings')}
        />

        <View style={{padding: 20}}>
          <Text>History</Text>
          <Text selectable={true}>{ logMessageSelector }</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
