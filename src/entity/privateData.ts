import { Entity, Column, BaseEntity, PrimaryColumn } from 'typeorm'

// The default is to use the class name but somehow Android loses the name in the apk.
@Entity("privateData")
export class PrivateData extends BaseEntity {

  /**
   * ID for this row (only for internal purposes)
   **/
  @PrimaryColumn('integer')
  //@ts-ignore
  id: number

  /**
   * DID that owns data
   **/
  @Column('text', { nullable: true })
  //@ts-ignore
  did: string

  /**
   * full claim
   **/
  @Column('text')
  //@ts-ignore
  claim: string

  /**
   * JSON-LD @context
   **/
  @Column('text', { nullable: true })
  //@ts-ignore
  claimContext: string

  /**
   * JSON-LD @type
   **/
  @Column('text', { nullable: true })
  //@ts-ignore
  claimType: string

  /**
   * time when this record was created
   **/
  @Column('integer')
  //@ts-ignore
  issuedAt: number

  /**
   * IPFS CID for the template for this contract
   **/
  @Column('text', { nullable: true })
  //@ts-ignore
  contractFormIpfsCid: string

  /**
   * Hash of the Legal MD format for this contract
   **/
  @Column('text', { nullable: true })
  //@ts-ignore
  contractFullMdHash: string

  /**
   * Host for the chain on the server where it's stored externally
   **/
  @Column('text', { nullable: true })
  //@ts-ignore
  serverHost: string

  /**
   * ID on server
   **/
  @Column('text', { nullable: true })
  //@ts-ignore
  serverId: string

  /**
   * Full URL for this signed data by this issuer on server
   **/
  @Column('text', { nullable: true })
  //@ts-ignore
  serverUrl: string

}
