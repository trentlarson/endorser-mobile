// Created from the setup in https://veramo.io/docs/guides/react_native

// Core interfaces
import { createAgent, IDIDManager, IResolver, IDataStore, IKeyManager } from '@veramo/core'

// Core identity manager plugin
import { DIDManager } from '@veramo/did-manager'

// Ethr did identity provider
import { EthrDIDProvider } from '@veramo/did-provider-ethr'

// Core key manager plugin
import { KeyManager } from '@veramo/key-manager'

// Custom key management system for RN
import { KeyManagementSystem } from '@veramo/kms-local-react-native'

// Custom resolver
// Custom resolvers
import { DIDResolverPlugin } from '@veramo/did-resolver'
import { Resolver } from 'did-resolver'
import { getResolver as ethrDidResolver } from 'ethr-did-resolver'
import { getResolver as webDidResolver } from 'web-did-resolver'

// for VCs and VPs https://veramo.io/docs/api/credential-w3c
import { CredentialIssuer } from '@veramo/credential-w3c'

// Storage plugin using TypeOrm
import { Entities, KeyStore, DIDStore, IDataStoreORM } from '@veramo/data-store'

// TypeORM is installed with @veramo/typeorm
import { createConnection } from 'typeorm'

import * as R from 'ramda'

import { Contact } from '../entity/contact'
import { Settings } from '../entity/settings'
import { PrivateData } from '../entity/privateData'

import { Initial1616938713828 }          from '../migration/1616938713828-initial'
import { SettingsContacts1616967972293 } from '../migration/1616967972293-settings-contacts'
import { EncryptedSeed1637856484788 }    from '../migration/1637856484788-EncryptedSeed'
import { HomeScreenConfig1639947962124 } from '../migration/1639947962124-HomeScreenConfig'
import { HandlePublicKeys1652142819353 } from '../migration/1652142819353-HandlePublicKeys'
import { LastClaimsSeen1656811846836 }   from '../migration/1656811846836-LastClaimsSeen'
import { ContactRegistered1662256903367 }from '../migration/1662256903367-ContactRegistered'
import { PrivateData1663080623479 }      from '../migration/1663080623479-PrivateData'

const ALL_ENTITIES = Entities.concat([Contact, Settings, PrivateData])



// Create react native DB connection configured by ormconfig.js
export const dbConnection = createConnection({
  database: 'endorser-mobile.sqlite',
  entities: ALL_ENTITIES,
  location: 'default',
  logging: ['error', 'info', 'warn'],
  migrations: [ Initial1616938713828, SettingsContacts1616967972293, EncryptedSeed1637856484788, HomeScreenConfig1639947962124, HandlePublicKeys1652142819353, LastClaimsSeen1656811846836, ContactRegistered1662256903367, PrivateData1663080623479 ],
  migrationsRun: true,
  type: 'react-native',
})

function didProviderName(netName) {
  return 'did:ethr' + (netName === 'mainnet' ? '' : ':' + netName)
}

const NETWORK_NAMES = ['mainnet', 'rinkeby']

const DEFAULT_DID_PROVIDER_NETWORK_NAME = 'mainnet'

export const DEFAULT_DID_PROVIDER_NAME = didProviderName(DEFAULT_DID_PROVIDER_NETWORK_NAME)

export const HANDY_APP = true

// this is used as the object in RegisterAction claims
export const SERVICE_ID = 'endorser.ch'

const INFURA_PROJECT_ID = 'INFURA_PROJECT_ID'

const providers = {}
NETWORK_NAMES.forEach((networkName) => {
  providers[didProviderName(networkName)] = new EthrDIDProvider({
    defaultKms: 'local',
    network: networkName,
    rpcUrl: 'https://' + networkName + '.infura.io/v3/' + INFURA_PROJECT_ID,
    gas: 1000001,
    ttl: 60 * 60 * 24 * 30 * 12 + 1,
  })
})

const didManager = new DIDManager({
  store: new DIDStore(dbConnection),
  defaultProvider: DEFAULT_DID_PROVIDER_NAME,
  providers: providers,
})

const basicDidResolvers = NETWORK_NAMES.map((networkName) =>
  [
    networkName,
    new Resolver({
      ethr: ethrDidResolver({
        networks: [{ name: networkName, rpcUrl: 'https://' + networkName + '.infura.io/v3/' + INFURA_PROJECT_ID }],
      }).ethr,
      web: webDidResolver().web,
    })
  ]
)

const basicResolverMap = R.fromPairs(basicDidResolvers)

export const DEFAULT_BASIC_RESOLVER = basicResolverMap[DEFAULT_DID_PROVIDER_NETWORK_NAME]

const agentDidResolvers = NETWORK_NAMES.map((networkName) => {
  return new DIDResolverPlugin({
    resolver: basicResolverMap[networkName],
  })
})

let allPlugins = [
  new CredentialIssuer(),
  new KeyManager({
    store: new KeyStore(dbConnection),
    kms: {
      local: new KeyManagementSystem(),
    },
  }),
  didManager,
].concat(agentDidResolvers)

export const agent = createAgent<IDIDManager & IKeyManager & IDataStore & IDataStoreORM & IResolver>({ plugins: allPlugins })
