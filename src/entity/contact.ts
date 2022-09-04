import { Entity, Column, BaseEntity, PrimaryColumn } from 'typeorm'

// The default is to use the class name but somehow Android loses the name in the apk.
@Entity("contact")
export class Contact extends BaseEntity {

  @Column('text', { nullable: true })
  //@ts-ignore
  name: string

  // The ones in @veramo/data-store don't require explicit types but I get ColumnTypeUndefinedError
  @PrimaryColumn('text')
  //@ts-ignore
  did: string

  @Column('text', { nullable: true })
  //@ts-ignore
  pubKeyBase64: string

  /**
   * Cache of whether they are able to see this person on the server.
   */
  @Column('boolean', { nullable: true })
  //@ts-ignore
  seesMe: boolean

  /**
   * Cache of whether they are registered on the server (and able to create claims).
   */
  @Column('boolean', { nullable: true })
  //@ts-ignore
  registered: boolean

}
