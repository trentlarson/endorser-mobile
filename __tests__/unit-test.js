import crypto from 'crypto'
import { DateTime, Duration } from 'luxon'
import MerkleTools from 'merkle-tools'
import * as R from 'ramda'
import * as utility from '../src/utility/utility'

test('first and last 3', () => {
  expect(utility.firstAndLast3OfDid(null)).toBe('(BLANK)')
  expect(utility.firstAndLast3OfDid('')).toBe('(BLANK)')
  expect(utility.firstAndLast3OfDid('did:none:HIDDEN')).toBe('(HIDDEN)')
  expect(utility.firstAndLast3OfDid('did:btcr:1FeexV6bAHb8ybZjqQMjJrcCrHGW9sb6uF')).toBe('1Fe...6uF')
  expect(utility.firstAndLast3OfDid('0x000Ee5654b9742f6Fe18ea970e32b97ee2247B51')).toBe('(NOT_A_DID)')
  expect(utility.firstAndLast3OfDid('did:ethr:0x000Ee5654b9742f6Fe18ea970e32b97ee2247B51')).toBe('000...B51')
})

test('account Offers & Gives', () => {
  const TEST_USER_DID = 'did:none:test-user-0'
  const TEST_USER1_DID = 'did:none:test-user-1'
  const EMPTY_OUTPUT = {
    allPaid: [],
    allPromised: [],
    outstandingCurrencyTotals: {},
    outstandingInvoiceTotals: {},
    totalCurrencyPaid: {},
    totalCurrencyPromised: {},
    idsOfStranges: [],
    idsOfUnknowns: []
  }
  let input = []
  let outputExp = R.clone(EMPTY_OUTPUT)
  expect(utility.countTransactions(input, TEST_USER_DID)).toEqual(outputExp)

  input[0] = { claim: { '@context': 'http://somewhere.else' }}
  outputExp.idsOfUnknowns = [undefined]
  expect(utility.countTransactions(input, TEST_USER_DID)).toEqual(outputExp)

  input[0] = {
    issuedAt: '2022-02-15 18:58:33Z',
    claim: { '@context': 'https://schema.org' },
  }
  expect(utility.countTransactions(input, TEST_USER_DID)).toEqual(outputExp)

  input[0].claim['@type'] = 'Offer'
  outputExp.idsOfStranges = [undefined]
  outputExp.idsOfUnknowns = []
  expect(utility.countTransactions(input, TEST_USER_DID)).toEqual(outputExp)

  input[0].claim.seller = { identifier: 'did:none:test-user-bad' }
  expect(utility.countTransactions(input, TEST_USER_DID)).toEqual(outputExp)

  input[0].claim.seller = { identifier: TEST_USER_DID }
  expect(utility.countTransactions(input, TEST_USER_DID)).toEqual(outputExp)

  input[0].claim.itemOffered = { amountOfThisGood: 'bad' }
  expect(utility.countTransactions(input, TEST_USER_DID)).toEqual(outputExp)

  input = input.concat({
    id: 'abc123',
    issuedAt: '2022-02-15 18:58:33Z',
    claim: {
      '@context': 'https://schema.org',
      '@type': 'Offer',
      itemOffered: { amountOfThisGood: 3 },
      offeredBy: { identifier: TEST_USER_DID },
    }
  })
  outputExp.idsOfStranges = [undefined, 'abc123']
  expect(utility.countTransactions(input, TEST_USER_DID)).toEqual(outputExp)

  input[1].claim.itemOffered = { amountOfThisGood: 3, unitCode: 'HUR' }
  outputExp.allPromised = [input[1]]
  outputExp.idsOfStranges = [undefined]
  outputExp.outstandingCurrencyTotals = { "HUR": 3 }
  outputExp.totalCurrencyPromised = { "HUR": 3 }
  expect(utility.countTransactions(input, TEST_USER_DID)).toEqual(outputExp)

  const OFFER_ID = '0f21cc1d44412b4ac4cb47973554fd79'
  input = input.concat({
    issuedAt: '2022-02-15 18:58:33Z',
    claim: {
      '@context': 'https://schema.org',
      '@type': 'Offer',
      identifier: OFFER_ID,
      itemOffered: { amountOfThisGood: 2, unitCode: 'HUR' },
      offeredBy: { identifier: TEST_USER_DID },
    }
  })
  outputExp.allPromised = [input[1], input[2]]
  outputExp.outstandingCurrencyTotals = { "HUR": 5 }
  outputExp.outstandingInvoiceTotals = { "0f21cc1d44412b4ac4cb47973554fd79": 2 }
  outputExp.totalCurrencyPromised = { "HUR": 5 }
  expect(utility.countTransactions(input, TEST_USER_DID)).toEqual(outputExp)

  input = input.concat({
    issuedAt: '2022-02-15 18:58:33Z',
    claim: {
      '@context': 'https://schema.org',
      '@type': 'Offer',
      identifier: 'ef56cb471f43cdd024b06baa11a8ce24',
      itemOffered: { amountOfThisGood: 1, unitCode: 'HUR' },
      offeredBy: { identifier: TEST_USER_DID },
    }
  })
  outputExp.allPromised = [input[1], input[2], input[3]]
  outputExp.outstandingCurrencyTotals = { "HUR": 6 }
  outputExp.outstandingInvoiceTotals = { "0f21cc1d44412b4ac4cb47973554fd79": 2, "ef56cb471f43cdd024b06baa11a8ce24": 1 }
  outputExp.totalCurrencyPromised = { "HUR": 6 }
  expect(utility.countTransactions(input, TEST_USER_DID)).toEqual(outputExp)

  input = input.concat({
    issuedAt: '2022-02-15 18:58:33Z',
    claim: {
      '@context': 'https://schema.org',
      '@type': 'Offer',
      itemOffered: { amountOfThisGood: 1, unitCode: 'BTC' },
      offeredBy: { identifier: TEST_USER_DID },
      recipient: { identifier: TEST_USER1_DID },
      validThrough: DateTime.local().plus(Duration.fromISO('P6M')),
    }
  })
  outputExp.allPromised = [input[1], input[2], input[3], input[4]]
  outputExp.outstandingCurrencyTotals = { "BTC": 1, "HUR": 6 }
  outputExp.outstandingInvoiceTotals = { "0f21cc1d44412b4ac4cb47973554fd79": 2, "ef56cb471f43cdd024b06baa11a8ce24": 1 }
  outputExp.outstandingInvoiceTotals[TEST_USER1_DID] = 1
  outputExp.totalCurrencyPromised = { "BTC": 1, "HUR": 6 }
  expect(utility.countTransactions(input, TEST_USER_DID)).toEqual(outputExp)

  input = input.concat({
    issuedAt: '2022-02-15 18:58:33Z',
    claim: {
      '@context': 'https://schema.org',
      '@type': 'Offer',
      itemOffered: { amountOfThisGood: 1, unitCode: 'BTC' },
      offeredBy: { identifier: TEST_USER_DID },
      recipient: { identifier: TEST_USER1_DID },
      validThrough: DateTime.local().minus(Duration.fromISO('P6M')),
    }
  })
  outputExp.allPromised = [input[1], input[2], input[3], input[4], input[5]]
  outputExp.totalCurrencyPromised["BTC"] = 2
  expect(utility.countTransactions(input, TEST_USER_DID)).toEqual(outputExp)


  // Now for "Give"

  input = input.concat({
    issuedAt: '2022-02-15 18:58:33Z',
    claim: {
      '@context': 'https://schema.org',
      '@type': 'GiveAction',
      object: { amountOfThisGood: 1, unitCode: 'bad-txn-no-agent' },
    }
  })
  outputExp.idsOfStranges = [undefined, undefined]
  expect(utility.countTransactions(input, TEST_USER_DID)).toEqual(outputExp)

  input = input.concat({
    issuedAt: '2022-02-15 18:58:33Z',
    claim: {
      '@context': 'https://schema.org',
      '@type': 'GiveAction',
      agent: { identifier: TEST_USER_DID },
      object: { amountOfThisGood: 1, unitCode: 'HUR' },
    }
  })
  outputExp.totalCurrencyPaid = { "HUR": 1 }
  outputExp.allPaid = [input[7]]
  expect(utility.countTransactions(input, TEST_USER_DID)).toEqual(outputExp)

  input = input.concat({
    issuedAt: '2022-02-15 18:58:33Z',
    claim: {
      '@context': 'https://schema.org',
      '@type': 'GiveAction',
      agent: { identifier: TEST_USER_DID },
      offerId: OFFER_ID,
      object: { amountOfThisGood: 1, unitCode: 'HUR' },
    }
  })
  outputExp.totalCurrencyPaid = { "HUR": 2 }
  outputExp.outstandingCurrencyTotals["HUR"] = 5
  outputExp.outstandingInvoiceTotals[OFFER_ID] = 1
  outputExp.allPaid = [input[7], input[8]]
  expect(utility.countTransactions(input, TEST_USER_DID)).toEqual(outputExp)

  input = input.concat({
    issuedAt: '2022-02-15 18:58:33Z',
    claim: {
      '@context': 'https://schema.org',
      '@type': 'GiveAction',
      agent: { identifier: TEST_USER_DID },
      object: { amountOfThisGood: 2, unitCode: 'HUR' },
      recipient: TEST_USER1_DID,
    }
  })
  outputExp.totalCurrencyPaid = { "HUR": 4 }
  outputExp.outstandingCurrencyTotals["HUR"] = 5
  outputExp.outstandingInvoiceTotals[OFFER_ID] = 1
  outputExp.allPaid = [input[7], input[8], input[9]]
  expect(utility.countTransactions(input, TEST_USER_DID)).toEqual(outputExp)

  input = input.concat({
    issuedAt: '2022-02-15 18:58:33Z',
    claim: {
      '@context': 'https://schema.org',
      '@type': 'GiveAction',
      agent: { identifier: TEST_USER_DID },
      object: { amountOfThisGood: 1.5, unitCode: 'BTC' },
      recipient: 'did:none:test-user-recipient',
    }
  })
  outputExp.totalCurrencyPaid["BTC"] = 1.5
  outputExp.allPaid = [input[7], input[8], input[9], input[10]]
  expect(utility.countTransactions(input, TEST_USER_DID)).toEqual(outputExp)


  // Now for another user

  outputExp = R.clone(EMPTY_OUTPUT)
  outputExp.idsOfStranges = [undefined, 'abc123'].concat(Array(9).fill(undefined))
  expect(utility.countTransactions(input, TEST_USER1_DID)).toEqual(outputExp)

})

test('merkle hashes are correct', () => {

  const sha256Hex = (value) => crypto.createHash('sha256').update(value).digest('hex')
  const sha256HexBuf = (value) => Buffer.from(sha256Hex(value), 'hex')

  const fields1 = {
    Party_1_Details: 'Me, Myself, and I\nElsewhere, UT',
  }
  const fields2 = {
      ...fields1,
    Party_2_Details: 'You, Yourself, and... You\nWaaaay Over There\nBy The Deep Blue Sea',
  }
  const fields5 = {
    ...fields2,
    Another_Field: 'Nother',
    Field_4: 'Tally Forth',
    Xtra_Field_5: 'Xtra! Xtra!',
  }
  const fieldValues = R.values(fields5)
  const fieldHashHexs = fieldValues.map(sha256Hex)
  const fieldHashBufs = fieldValues.map(sha256HexBuf)

  const merkler = new MerkleTools({ hashType: 'sha256' })
  // merkler.getMerkleRoot() == null right after constructor

  expect(utility.valuesMerkleRootHex(fields1)).toEqual(fieldHashHexs[0])

  const merkle01 = sha256Hex(Buffer.concat([fieldHashBufs[0], fieldHashBufs[1]]))
  expect(utility.valuesMerkleRootHex(fields2)).toEqual(merkle01)

  /** tests of merkle-tree

  merkler.resetTree()
  merkler.addLeaf(fields5["Party_1_Details"], true)
  merkler.makeTree(false)
  expect(merkler.getMerkleRoot().toString('hex')).toEqual(fieldHashHexs[0])

  const merkle01Again = sha256Hex(Buffer.concat([fieldHashBufs[0], fieldHashBufs[1]]))
  merkler.resetTree()
  merkler.addLeaf(fieldValues[0], true)
  merkler.addLeaf(fieldValues[1], true)
  merkler.makeTree(false)
  expect(merkler.getMerkleRoot().toString('hex')).toEqual(merkle01Again)

  const merkle01Again2 = sha256Hex(Buffer.concat([sha256HexBuf(fieldValues[0]), sha256HexBuf(fieldValues[1])]))
  merkler.resetTree()
  merkler.addLeaf(fieldValues[0], true)
  merkler.addLeaf(fieldValues[1], true)
  merkler.makeTree(false)
  expect(merkler.getMerkleRoot().toString('hex')).toEqual(merkle01Again2)

  **/

  const fullHashes =
        sha256HexBuf(Buffer.concat([
          sha256HexBuf(Buffer.concat([
            sha256HexBuf(Buffer.concat([fieldHashBufs[0], fieldHashBufs[1]])),
            sha256HexBuf(Buffer.concat([fieldHashBufs[2], fieldHashBufs[3]])),
          ])),
          sha256HexBuf(fields5['Xtra_Field_5'])
        ]))
        .toString('hex')
  expect(utility.valuesMerkleRootHex(fields5)).toEqual(fullHashes)

})

test('legal MD construction & hashes are correct', () => {
  expect(utility.contractPrefix({})).toEqual('---\n---\n')
  expect(utility.contractPrefix({'a': '1'})).toEqual('---\na: "1"\n---\n')
  const fields5 = {
    Party_1_Details: 'Me, Myself, and I\nElsewhere, UT',
    Party_2_Details: 'You, Yourself, and... You\nWaaaay Over There\nBy The Deep Blue Sea',
    Another_Field: 'Nother',
    Field_4: 'Tally Forth\n',
    Xtra_Field_5: 'Xtra! Xtra!',
  }
  const fields5Yaml =
`---
Party_1_Details: |
  Me, Myself, and I
  Elsewhere, UT
Party_2_Details: |
  You, Yourself, and... You
  Waaaay Over There
  By The Deep Blue Sea
Another_Field: "Nother"
Field_4: |
  Tally Forth
Xtra_Field_5: "Xtra! Xtra!"
---
`
  expect(utility.contractPrefix(fields5)).toEqual(fields5Yaml)
})
