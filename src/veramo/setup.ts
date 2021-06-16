// Created from the setup in https://veramo.io/docs/guides/react_native

// Core interfaces
import { createAgent, IDIDManager, IResolver, IDataStore, IKeyManager } from '@veramo/core'

// Core identity manager plugin
import { DIDManager } from '@veramo/did-manager'

// Ethr DID identity provider
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
import { PeerDidProvider, PEER_DID_PREFIX } from './peerDidProvider'

import { Initial1616938713828 } from '../migration/1616938713828-initial'
import { SettingsContacts1616967972293 } from '../migration/1616967972293-settings-contacts'

// You will need to get a project ID from infura https://www.infura.io
const INFURA_PROJECT_ID = '0f439b3b9237480ea8eb9da7b1f3965a'

const ALL_ENTITIES = Entities.concat([Contact, Settings])



// Create react native DB connection configured by ormconfig.js
export const dbConnection = createConnection({
  database: 'endorser-mobile.sqlite',
  entities: ALL_ENTITIES,
  location: 'default',
  logging: ['error', 'info', 'warn'],
  migrations: [ Initial1616938713828, SettingsContacts1616967972293 ],
  migrationsRun: true,
  type: 'react-native',
})

function ethrDidProviderName(netName) {
  return 'did:ethr' + (netName === 'mainnet' ? '' : ':' + netName)
}

const ETHR_NETWORK_NAMES = ['mainnet', 'rinkeby']
const DEFAULT_ETHR_DID_PROVIDER_NETWORK_NAME = 'mainnet'
export const DEFAULT_ETHR_DID_PROVIDER_NAME = ethrDidProviderName(DEFAULT_ETHR_DID_PROVIDER_NETWORK_NAME)

const providers = {}
providers[PEER_DID_PREFIX] = new PeerDidProvider({ defaultKms: 'local' })
ETHR_NETWORK_NAMES.forEach((networkName) => {
  providers[ethrDidProviderName(networkName)] = new EthrDIDProvider({
    defaultKms: 'local',
    network: networkName,
    rpcUrl: 'https://' + networkName + '.infura.io/v3/' + INFURA_PROJECT_ID,
    gas: 1000001,
    ttl: 60 * 60 * 24 * 30 * 12 + 1,
  })
})

const didManager = new DIDManager({
  store: new DIDStore(dbConnection),
  defaultProvider: DEFAULT_ETHR_DID_PROVIDER_NAME,
  providers: providers,
})

const ethrDidResolvers = ETHR_NETWORK_NAMES.map((networkName) =>
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

const ethrResolverMap = R.fromPairs(ethrDidResolvers)
export const DEFAULT_BASIC_RESOLVER = ethrResolverMap[DEFAULT_ETHR_DID_PROVIDER_NETWORK_NAME]

const agentDidResolvers = ETHR_NETWORK_NAMES.map((networkName) => {
  return new DIDResolverPlugin({
    resolver: ethrResolverMap[networkName],
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
