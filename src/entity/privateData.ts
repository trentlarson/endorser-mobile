import { Entity, Column, BaseEntity, PrimaryColumn } from 'typeorm'

// The default is to use the class name but somehow Android loses the name in the apk.
@Entity("privateData")
export class PrivateData extends BaseEntity {

  /**
   * ID for this row (only for internal purposes)
   **/
  @PrimaryColumn('text')
  //@ts-ignore
  id: number

  /**
   * JSON string of all private fields
   **/
  @Column('text')
  //@ts-ignore
  fields: string

  /**
   * Merkle root for the field values
   **/
  @Column('text')
  //@ts-ignore
  fieldsMerkle: string

  /**
   * DID that owns data
   **/
  @Column('text', { nullable: true })
  //@ts-ignore
  did: string

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
   * IPFS CID for the template for this contract
   **/
  @Column('text', { nullable: true })
  //@ts-ignore
  templateIpfsCid: string

  /**
   * Hash of the Legal MD format for this contract
   **/
  @Column('text', { nullable: true })
  //@ts-ignore
  legalMdHash: string

}
