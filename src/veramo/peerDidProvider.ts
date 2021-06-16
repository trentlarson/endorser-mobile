import bs58 from 'bs58'
import nodeCrypto from 'crypto';
import { IIdentifier, IKey, IService, IAgentContext, IKeyManager } from '@veramo/core'
import { AbstractIdentifierProvider } from '@veramo/did-manager'

type IContext = IAgentContext<IKeyManager>

/**
 * @param publicKeyHex: string
 *
 * https://identity.foundation/peer-did-method-spec/index.html#method-specific-identifier
 */
export const peerAddressFromPublicKey = (publicKeyHex: string): string => {
  const multicodecBuf: Buffer = Buffer.from([0x12, 0x20]);
  const basisBuf = Buffer.from(publicKeyHex, 'hex')
  const numAlgoBuf: Buffer = nodeCrypto
    .createHash('sha256')
    .update(basisBuf)
    .digest();
  const encnumbasisBuf: Buffer = Buffer.concat([multicodecBuf, numAlgoBuf]);
  const encnumbasis: string = bs58.encode(encnumbasisBuf);
  const peerDid = '0z' + encnumbasis;
  return peerDid;
}

/**
 * {@link @veramo/did-manager#DIDManager} identifier provider for `did:peer` identifiers
 * Note that the following are unimplemented and throw errors: addKey, addService, removeKey, removeService
 *
 * @public
 */
export class PeerDidProvider extends AbstractIdentifierProvider {
  private defaultKms: string
  private network: string

  constructor(options: {
    defaultKms: string
    network: string
  }) {
    super()
    this.defaultKms = options.defaultKms
    this.network = options.network
  }

  async createIdentifier(
    { kms, options }: { kms?: string; options?: any },
    context: IContext,
  ): Promise<Omit<IIdentifier, 'provider'>> {
    const key = await context.agent.keyManagerCreate({ kms: kms || this.defaultKms, type: 'Secp256k1' })
    const address = peerAddressFromPublicKey(key.publicKeyHex)
    const identifier: Omit<IIdentifier, 'provider'> = {
      did: 'did:peer:' + address,
      controllerKeyId: key.kid,
      keys: [key],
      services: [],
    }
    return identifier
  }

  async deleteIdentifier(identifier: IIdentifier, context: IContext): Promise<boolean> {
    for (const { kid } of identifier.keys) {
      await context.agent.keyManagerDelete({ kid })
    }
    return true
  }

  async addKey(
    { identifier, key, options }: { identifier: IIdentifier; key: IKey; options?: any },
    context: IContext,
  ): Promise<any> {
    throw 'PeerDidProvider.addKey not implemented'
  }

  async addService(
    { identifier, service, options }: { identifier: IIdentifier; service: IService; options?: any },
    context: IContext,
  ): Promise<any> {
    throw 'PeerDidProvider.addService not implemented'
  }

  async removeKey(
    args: { identifier: IIdentifier; kid: string; options?: any },
    context: IContext,
  ): Promise<any> {
    throw 'PeerDidProvider.removeKey not implemented'
  }

  async removeService(
    args: { identifier: IIdentifier; id: string; options?: any },
    context: IContext,
  ): Promise<any> {
    throw 'PeerDidProvider.removeService not implemented'
  }
}
