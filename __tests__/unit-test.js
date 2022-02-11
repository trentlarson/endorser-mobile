import { DateTime, Duration } from 'luxon'
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
  let input = []
  const outputExp = {
    outstandingCurrencyTotals: {},
    outstandingInvoiceTotals: {},
    totalCurrencyPaid: {},
    totalCurrencyPromised: {},
    numPaid: 0,
    numPromised: 0,
    numUnknowns: 0
  }
  expect(utility.countTransactions(input, TEST_USER_DID)).toEqual(outputExp)

  input[0] = { claim: { '@context': 'http://somewhere.else' }}
  expect(utility.countTransactions(input, TEST_USER_DID)).toEqual(outputExp)

  input[0] = { claim: { '@context': 'https://schema.org' }}
  expect(utility.countTransactions(input, TEST_USER_DID)).toEqual(outputExp)

  input[0].claim['@type'] = 'Offer'
  outputExp.numUnknowns = 1
  expect(utility.countTransactions(input, TEST_USER_DID)).toEqual(outputExp)

  input[0].claim.seller = { identifier: 'did:none:test-user-bad' }
  expect(utility.countTransactions(input, TEST_USER_DID)).toEqual(outputExp)

  input[0].claim.seller = { identifier: TEST_USER_DID }
  expect(utility.countTransactions(input, TEST_USER_DID)).toEqual(outputExp)

  input[0].claim.itemOffered = { amountOfThisGood: 'bad' }
  expect(utility.countTransactions(input, TEST_USER_DID)).toEqual(outputExp)

  input = input.concat({ claim: {
    '@context': 'https://schema.org',
    '@type': 'Offer',
    itemOffered: { amountOfThisGood: 3 },
    offeredBy: { identifier: TEST_USER_DID },
  }})
  outputExp.numUnknowns = 2
  expect(utility.countTransactions(input, TEST_USER_DID)).toEqual(outputExp)

  input[1].claim.itemOffered = { amountOfThisGood: 3, unitCode: 'HUR' }
  outputExp.numPromised = 1
  outputExp.numUnknowns = 1
  outputExp.outstandingCurrencyTotals = { "HUR": 3 }
  outputExp.totalCurrencyPromised = { "HUR": 3 }
  expect(utility.countTransactions(input, TEST_USER_DID)).toEqual(outputExp)

  const OFFER_ID = '0f21cc1d44412b4ac4cb47973554fd79'
  input = input.concat({ claim: {
    '@context': 'https://schema.org',
    '@type': 'Offer',
    identifier: OFFER_ID,
    itemOffered: { amountOfThisGood: 2, unitCode: 'HUR' },
    offeredBy: { identifier: TEST_USER_DID },
  }})
  outputExp.numPromised = 2
  outputExp.outstandingCurrencyTotals = { "HUR": 5 }
  outputExp.outstandingInvoiceTotals = { "0f21cc1d44412b4ac4cb47973554fd79": 2 }
  outputExp.totalCurrencyPromised = { "HUR": 5 }
  expect(utility.countTransactions(input, TEST_USER_DID)).toEqual(outputExp)

  input = input.concat({ claim: {
    '@context': 'https://schema.org',
    '@type': 'Offer',
    identifier: 'ef56cb471f43cdd024b06baa11a8ce24',
    itemOffered: { amountOfThisGood: 1, unitCode: 'HUR' },
    offeredBy: { identifier: TEST_USER_DID },
  }})
  outputExp.numPromised = 3
  outputExp.outstandingCurrencyTotals = { "HUR": 6 }
  outputExp.outstandingInvoiceTotals = { "0f21cc1d44412b4ac4cb47973554fd79": 2, "ef56cb471f43cdd024b06baa11a8ce24": 1 }
  outputExp.totalCurrencyPromised = { "HUR": 6 }
  expect(utility.countTransactions(input, TEST_USER_DID)).toEqual(outputExp)

  input = input.concat({ claim: {
    '@context': 'https://schema.org',
    '@type': 'Offer',
    itemOffered: { amountOfThisGood: 1, unitCode: 'BTC' },
    offeredBy: { identifier: TEST_USER_DID },
    recipient: { identifier: TEST_USER1_DID },
    validThrough: DateTime.local().plus(Duration.fromISO('P6M')),
  }})
  outputExp.numPromised = 4
  outputExp.outstandingCurrencyTotals = { "BTC": 1, "HUR": 6 }
  outputExp.outstandingInvoiceTotals = { "0f21cc1d44412b4ac4cb47973554fd79": 2, "ef56cb471f43cdd024b06baa11a8ce24": 1 }
  outputExp.outstandingInvoiceTotals[TEST_USER1_DID] = 1
  outputExp.totalCurrencyPromised = { "BTC": 1, "HUR": 6 }
  expect(utility.countTransactions(input, TEST_USER_DID)).toEqual(outputExp)

  input = input.concat({ claim: {
    '@context': 'https://schema.org',
    '@type': 'Offer',
    itemOffered: { amountOfThisGood: 1, unitCode: 'BTC' },
    offeredBy: { identifier: TEST_USER_DID },
    recipient: { identifier: TEST_USER1_DID },
    validThrough: DateTime.local().minus(Duration.fromISO('P6M')),
  }})
  outputExp.numPromised = 5
  outputExp.totalCurrencyPromised["BTC"] = 2
  expect(utility.countTransactions(input, TEST_USER_DID)).toEqual(outputExp)


  // Now for "Give"

  input = input.concat({ claim: {
    '@context': 'https://schema.org',
    '@type': 'GiveAction',
    object: { amountOfThisGood: 1, unitCode: 'bad-txn-no-agent' },
  }})
  outputExp.numUnknowns = 2
  expect(utility.countTransactions(input, TEST_USER_DID)).toEqual(outputExp)

  input = input.concat({ claim: {
    '@context': 'https://schema.org',
    '@type': 'GiveAction',
    agent: { identifier: TEST_USER_DID },
    object: { amountOfThisGood: 1, unitCode: 'HUR' },
  }})
  outputExp.totalCurrencyPaid = { "HUR": 1 }
  outputExp.numPaid = 1
  expect(utility.countTransactions(input, TEST_USER_DID)).toEqual(outputExp)

  input = input.concat({ claim: {
    '@context': 'https://schema.org',
    '@type': 'GiveAction',
    agent: { identifier: TEST_USER_DID },
    offerId: OFFER_ID,
    object: { amountOfThisGood: 1, unitCode: 'HUR' },
  }})
  outputExp.totalCurrencyPaid = { "HUR": 2 }
  outputExp.outstandingCurrencyTotals["HUR"] = 5
  outputExp.outstandingInvoiceTotals[OFFER_ID] = 1
  outputExp.numPaid = 2
  expect(utility.countTransactions(input, TEST_USER_DID)).toEqual(outputExp)

  input = input.concat({ claim: {
    '@context': 'https://schema.org',
    '@type': 'GiveAction',
    agent: { identifier: TEST_USER_DID },
    object: { amountOfThisGood: 2, unitCode: 'HUR' },
    recipient: TEST_USER1_DID,
  }})
  outputExp.totalCurrencyPaid = { "HUR": 4 }
  outputExp.outstandingCurrencyTotals["HUR"] = 5
  outputExp.outstandingInvoiceTotals[OFFER_ID] = 1
  outputExp.numPaid = 3
  expect(utility.countTransactions(input, TEST_USER_DID)).toEqual(outputExp)

  input = input.concat({ claim: {
    '@context': 'https://schema.org',
    '@type': 'GiveAction',
    agent: { identifier: TEST_USER_DID },
    object: { amountOfThisGood: 1.5, unitCode: 'BTC' },
    recipient: 'did:none:test-user-recipient',
  }})
  outputExp.totalCurrencyPaid["BTC"] = 1.5
  outputExp.numPaid = 4
  expect(utility.countTransactions(input, TEST_USER_DID)).toEqual(outputExp)

})
