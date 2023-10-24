import { Entity, Column, BaseEntity, PrimaryColumn } from "typeorm";

// The default is to use the class name but somehow Android loses the name in the apk.
@Entity("claimBookmark")
export class ClaimBookmark extends BaseEntity {

  /**
   The permanent ID of this credential

   Since there is a default server, this is usually non-global claim identifier.
   This could provide a globally unique reference, potentially resolvable (maybe with help of the context).
   **/
  @PrimaryColumn('text')
  //@ts-ignore
  claimId: string

  /**
   Cached text of the full claim, JSON-stringified

   If not supplied, this will be the string "null" but never the null value.
   In endorser.ch, the values referred to by a handleId can change, which is why this is labeled as a cached value.
   **/
  @Column('text', { nullable: false })
  //@ts-ignore
  cachedClaimStr: string

  /**
   The @context property in a credential
   **/
  @Column('text', { nullable: true })
  //@ts-ignore
  context: string

  /**
   Date issued, in ISO date-time format
   **/
  @Column('text', { nullable: true })
  //@ts-ignore
  issuedAt: string

  /**
   DID of issuer
   **/
  @Column('text', { nullable: true })
  //@ts-ignore
  issuer: string

  /**
   Whatever name the user wants to give this credential

   This may be '' but never null.
   **/
  @Column('text', { nullable: false })
  //@ts-ignore
  name: string

  /**
   The @type property in a credential
   **/
  @Column('text', { nullable: true })
  //@ts-ignore
  type: string

}
