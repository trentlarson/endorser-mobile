import * as utility from '../src/utility/utility'

test('first and last 3', () => {
  expect(utility.firstAndLast3OfDid(null)).toBe('(BLANK)')
  expect(utility.firstAndLast3OfDid('')).toBe('(BLANK)')
  expect(utility.firstAndLast3OfDid('did:none:HIDDEN')).toBe('(HIDDEN)')
  expect(utility.firstAndLast3OfDid('did:btcr:1FeexV6bAHb8ybZjqQMjJrcCrHGW9sb6uF')).toBe('1Fe...6uF')
  expect(utility.firstAndLast3OfDid('0x000Ee5654b9742f6Fe18ea970e32b97ee2247B51')).toBe('(NOT_A_DID)')
  expect(utility.firstAndLast3OfDid('did:ethr:0x000Ee5654b9742f6Fe18ea970e32b97ee2247B51')).toBe('000...B51')
})
