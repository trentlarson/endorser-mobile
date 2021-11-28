import { Entity, Column, BaseEntity, PrimaryColumn } from 'typeorm'

/**
  There's only one Settings DB entry, with a column for each setting.
**/

export const MASTER_COLUMN_VALUE = 'MASTER'

// The default is to use the class name but somehow Android loses the name in the apk.
@Entity("settings")
export class Settings extends BaseEntity {
  // The ones in @veramo/data-store don't require explicit types but I get ColumnTypeUndefinedError

  /**
    Currently this has a single entry so it's a constant string, eg "MASTER"
   **/
  @PrimaryColumn('text')
  //@ts-ignore
  id: string

  /**
    If there's an ivBase64 then this is an base-64-encoded, encrypted string; otherwise, it's plain text.
   **/
  @Column('text', { nullable: true })
  //@ts-ignore
  mnemonic: string

  /**
    base-64-encoded
   **/
  @Column('text', { nullable: true })
  //@ts-ignore
  ivBase64: string

  /**
    random text
   **/
  @Column('text', { nullable: true })
  //@ts-ignore
  salt: string

  @Column('text', { nullable: true })
  //@ts-ignore
  name: string
}
