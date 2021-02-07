import { Entity, Column, BaseEntity, PrimaryColumn } from 'typeorm'

/**
  There's only one Settings DB entry, with a column for each setting.
**/

export const MASTER_COLUMN_VALUE = 'MASTER'

@Entity()
export class Settings extends BaseEntity {
  // The ones in @veramo/data-store don't require explicit types but I get ColumnTypeUndefinedError

  /**
    Currently this has a single entry so it's a constant string, eg "MASTER"
  **/
  @PrimaryColumn('text')
  //@ts-ignore
  id: string

  /**
    Support one mnemonic.  If you've got multiple DIDs then derive them from the master key.
  **/
  @Column('text', { nullable: true })
  //@ts-ignore
  mnemonic: string
}
