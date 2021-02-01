import { Entity, Column, BaseEntity, PrimaryColumn } from 'typeorm'

/**
  There's only one Settings DB entry, with a column for each setting.
**/

@Entity()
export class Settings extends BaseEntity {
  // The ones in @veramo/data-store don't require explicit types but I get ColumnTypeUndefinedError

  /**
    Single entry, so currently always 'master'
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
