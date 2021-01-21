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

// Storage plugin using TypeOrm
import { Entities, KeyStore, DIDStore, IDataStoreORM } from '@veramo/data-store'

// TypeORM is installed with @veramo/typeorm
import { createConnection } from 'typeorm'


// You will need to get a project ID from infura https://www.infura.io
const INFURA_PROJECT_ID = '0f439b3b9237480ea8eb9da7b1f3965a'

export const NETWORK = 'rinkeby'

export const DID_PROVIDER = 'did:ethr' + (NETWORK === 'mainnet' ? '' : ':' + NETWORK)


// Create react native db connection
const dbConnection = createConnection({
  type: 'react-native',
  database: 'veramo.sqlite',
  location: 'default',
  synchronize: true,
  logging: ['error', 'info', 'warn'],
  entities: Entities,
})


let providers = {}
providers[DID_PROVIDER] = new EthrDIDProvider({
  defaultKms: 'local',
  network: NETWORK,
  rpcUrl: 'https://' + NETWORK + '.infura.io/v3/' + INFURA_PROJECT_ID,
  gas: 1000001,
  ttl: 60 * 60 * 24 * 30 * 12 + 1,
})

export const agent = createAgent<IDIDManager & IKeyManager & IDataStore & IDataStoreORM & IResolver>({
  plugins: [
    new KeyManager({
      store: new KeyStore(dbConnection),
      kms: {
        local: new KeyManagementSystem(),
      },
    }),
    new DIDManager({
      store: new DIDStore(dbConnection),
      defaultProvider: DID_PROVIDER,
      providers: providers,
    }),
    new DIDResolverPlugin({
      resolver: new Resolver({
        ethr: ethrDidResolver({
          networks: [{ name: NETWORK, rpcUrl: 'https://' + NETWORK + '.infura.io/v3/' + INFURA_PROJECT_ID }],
        }).ethr,
        web: webDidResolver().web,
      }),
    }),
  ],
})
