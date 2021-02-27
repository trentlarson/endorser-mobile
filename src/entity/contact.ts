import { Entity, Column, BaseEntity, PrimaryColumn } from 'typeorm'

@Entity()
export class Contact extends BaseEntity {
  // The ones in @veramo/data-store don't require explicit types but I get ColumnTypeUndefinedError
  @PrimaryColumn('text')
  //@ts-ignore
  did: string

  @Column('text', { nullable: true })
  //@ts-ignore
  name: string

  /**
   * Cache of whether they are able to see this person on the server.
   */
  @Column('boolean', { nullable: true })
  //@ts-ignore
  seesMe: boolean
}
