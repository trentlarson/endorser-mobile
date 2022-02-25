import { classToPlain } from 'class-transformer'
import crypto from 'crypto';
import * as didJwt from 'did-jwt'
import { DateTime } from 'luxon'
import * as R from 'ramda'

import { Contact } from '../entity/contact'

// This is used to check for hidden info.
// See https://github.com/trentlarson/endorser-ch/blob/0cb626f803028e7d9c67f095858a9fc8542e3dbd/server/api/services/util.js#L6
const HIDDEN_DID = 'did:none:HIDDEN'

export const ENDORSER_JWT_URL_LOCATION = '/contact?jwt='
export const UPORT_JWT_PREFIX = 'https://id.uport.me/req/'

export function isDid(value) {
  return value && value.startsWith("did:") && (value.substring(5).indexOf(":") > -1)
}

export function rawAddressOfDid(did) {
  return did.split(":")[2]
}

// return first 3 chars + "..." + last 3 chars
const firstAndLast3 = (text) => {
  return text.slice(0,3) + "..." + text.slice(-3)
}

export const isHiddenDid = (did) => {
  return did === HIDDEN_DID
}

// insert a space in front of any capital letters (and capitalize first letter, just in case)
// return '' for null or undefined input
export const capitalizeAndInsertSpacesBeforeCaps = (text) =>{
  return !text ? '' : text[0].toUpperCase() + text.substr(1).replace(/([A-Z])/g, ' $1')
}

// return true for any nested string where func(input) === true
function testRecursivelyOnString(func, input) {

  if (Object.prototype.toString.call(input) === "[object String]") {
    return func(input)

  } else if (input instanceof Object) {

    var result = []
    if (!Array.isArray(input)) {
      // it's an object
      for (const key in input) {
        if (testRecursivelyOnString(func, input[key])) {
          return true
        }
      }
    } else {
      // it's an array
      for (value of input) {
        if (testRecursivelyOnString(func, value)) {
          return true
        }
      }
    }
    return false
  } else {
    return false
  }
}

export const containsHiddenDid = (obj) => {
  return testRecursivelyOnString(str => str === HIDDEN_DID, obj)
}

export const containsNonHiddenDid = (obj) => {
  return testRecursivelyOnString(str => isDid(str) && !isHiddenDid(str), obj)
}

// take DID and extract address and return first and last 3 chars
export const firstAndLast3OfDid = (did) => {
  if (!did) {
    return "(BLANK)"
  }
  if (!isDid(did)) {
    return "(NOT_A_DID)"
  }
  if (isHiddenDid(did)) {
    return "(HIDDEN)"
  }
  const lastChars = rawAddressOfDid(did)
  if (!lastChars) {
    // There's no second colon, which should never happen.
    return firstAndLast3(did.substring("did:".length))
  }
  if (lastChars.startsWith("0x")) { // Ethereum DIDs
    return firstAndLast3(lastChars.substring(2))
  }
  return firstAndLast3(lastChars)
}

const UNKNOWN_CONTACT = "Unknown"

// always returns text; if unknown then UNKNOWN_CONTACT
function didInfo(did, identifiers, contacts) {
  const myId = R.find(i => i.did === did, identifiers)
  if (myId) {
    return "you"
  } else {
    const contact = R.find(c => c.did === did, contacts)
    if (contact) {
      return contact.name
    } else {
      return UNKNOWN_CONTACT
    }
  }
}

export function didInContext(did, identifiers, contacts) {
  let shortName = didInfo(did, identifiers, contacts)
  let visibleDid = shortName === UNKNOWN_CONTACT ? did : firstAndLast3OfDid(did)
  return shortName + (visibleDid && " (" + visibleDid + ")")
}

/**
 return readable summary of claim if possible
 extraTitle is optional
 **/
export const claimSummary = (claim, extraTitle) => {
  if (claim.claim) {
    // probably a Verified Credential
    claim = claim.claim
  }
  let type = claim['@type'] || 'UnknownType'
  return capitalizeAndInsertSpacesBeforeCaps(type) + (extraTitle || '')
}

/**
 return readable description of claim if possible
 identifiers is a list of objects with a 'did' field, each representhing the user
 contacts is a list of objects with a 'did' field for others and a 'name' field for their name
 **/
export const claimSpecialDescription = (claim, identifiers, contacts) => {
  if (claim.claim) {
    // probably a Verified Credential
    claim = claim.claim
  }
  const type = claim['@type'] || 'UnknownType'

  if (type === "JoinAction") {
    const contactInfo = didInContext(claim.agent.did, identifiers, contacts)
    let eventOrganizer = claim.event && claim.event.organizer && claim.event.organizer.name;
    eventOrganizer = eventOrganizer || "";
    let eventName = claim.event && claim.event.name;
    eventName = eventName ? " " + eventName : "";
    let fullEvent = eventOrganizer + eventName;
    fullEvent = fullEvent ? " at " + fullEvent : "";
    let eventDate = claim.event && claim.event.startTime;
    eventDate = eventDate ? " at " + eventDate : "";
    return contactInfo + fullEvent + eventDate;

  } else if (type === "Tenure") {
    var polygon = claim.spatialUnit.geo.polygon
    return didInContext(claim.party.did, identifiers, contacts) + " holding [" + polygon.substring(0, polygon.indexOf(" ")) + "...]"
  }
  return null
}

export const accessToken = async (identifier) => {
  const did: string = identifier.did
  const signer = didJwt.SimpleSigner(identifier.keys[0].privateKeyHex)

  const nowEpoch = Math.floor(Date.now() / 1000)
  const tomorrowEpoch = nowEpoch + (60 * 60 * 24)

  const uportTokenPayload = { exp: tomorrowEpoch, iat: nowEpoch, iss: did }
  const jwt: string = await didJwt.createJWT(uportTokenPayload, { issuer: did, signer })
  return jwt
}

export const loadContacts = async (appSlice, appStore, dbConnection, useCached) => {
  if (!appStore.getState().contacts || !useCached) {
    const conn = await dbConnection
    return conn.manager.find(Contact, {order: {name:'ASC'}})
    .then((foundContacts) => {
      return appStore.dispatch(appSlice.actions.setContacts(classToPlain(foundContacts)))
    })
  }
}

function sha1(input: Buffer): Buffer {
  return crypto.createHash('sha1').update(input).digest();
}

function passwordDeriveBytes(
  password: string,
  salt: string,
  iterations: number,
  len: number
): Buffer {
  let key = Buffer.from(password + salt);
  for (let i = 0; i < iterations; i += 1) {
    key = sha1(key);
  }
  if (key.length < len) {
    const hx = passwordDeriveBytes(password, salt, iterations - 1, 20);
    for (let counter = 1; key.length < len; counter += 1) {
      key = Buffer.concat([
        key,
        sha1(Buffer.concat([Buffer.from(counter.toString()), hx])),
      ]);
    }
  }
  return Buffer.alloc(len, key);
}

export function encryptAndBase64(
  plainText: string,
  password: string,
  salt: string,
  ivBase64: string
): string {
  const ivBuf = Buffer.from(ivBase64, 'base64');
  const key = passwordDeriveBytes(password, salt, 100, 32);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, Buffer.from(ivBuf));
  const part1 = cipher.update(plainText, 'utf8');
  const part2 = cipher.final();
  const encrypted = Buffer.concat([part1, part2]).toString('base64');
  return encrypted;
}

export function decryptFromBase64(
  encryptedBase64: string,
  password: string,
  salt: string,
  ivBase64: string
): string {
  const ivBuf = Buffer.from(ivBase64, 'base64');
  const key = passwordDeriveBytes(password, salt, 100, 32);
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(ivBuf));
  let decrypted = decipher.update(encryptedBase64, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export const vcPayload = (did: string, claim: any): JwtCredentialPayload => {
  return {
    sub: did,
    vc: {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      type: ['VerifiableCredential'],
      credentialSubject: claim,
    }
  }
}

export const createJwt = async (identifier: IIdentifier, payload: any): string => {
  const signer = didJwt.SimpleSigner(identifier.keys[0].privateKeyHex)
  const did: string = identifier.did
  return didJwt.createJWT(payload,{ issuer: did, signer })
}

export const bvcClaim = (did: string, startTime: string) => {
  return {
    '@context': 'http://schema.org',
    '@type': 'JoinAction',
    agent: {
      did: did,
    },
    event: {
      organizer: {
        name: 'Bountiful Voluntaryist Community',
      },
      name: 'Saturday Morning Meeting',
      startTime: startTime,
    }
  }
}

/**
 @return results of Settings.uportJwtPayload: { iat: number, iss: string (DID), own: { name, publicEncKey } }
 */
export const getContactPayloadFromJwtUrl = (jwtUrlText: string) => {
  let jwtText = jwtUrlText
  const endorserContextLoc = jwtText.indexOf(ENDORSER_JWT_URL_LOCATION)
  if (endorserContextLoc > -1) {
    jwtText = jwtText.substring(endorserContextLoc + ENDORSER_JWT_URL_LOCATION.length)
  }
  if (jwtText.startsWith(UPORT_JWT_PREFIX)) {
    jwtText = jwtText.substring(UPORT_JWT_PREFIX.length)
  }

  // JWT format: { header, payload, signature, data }
  const jwt = didJwt.decodeJWT(jwtText)

  return jwt.payload
}

/** This works, but I like the 'React' version better. See ClaimYaml utility.tsx
 *
const objectToYamlString = (obj, indentLevel) => {
  if (indentLevel == null) {
    indentLevel = 0
  }
  const indentString = R.join('', R.repeat('     ', indentLevel))

  if (obj instanceof Object) {
    if (Array.isArray(obj)) {
      // array: loop through elements
      return (
        R.join(
          "",
          obj.map((item, index) =>
            "\n" + indentString + "- " + objectToYamlString(item, indentLevel + 1)
          )
        )
      )
    } else {
      // regular object: loop through keys
      return (
        R.join(
          "",
          R.keys(obj).map((key, index) =>
            "\n" + indentString + key + " : " + objectToYamlString(obj[key], indentLevel + 1)
          )
        )
      )
    }
  } else {
    return JSON.stringify(obj)
  }
}
*
**/

/**
 * wrappedClaims are results from an Endorser.ch search, with 'claim' field
 *
 * results is an object with these fields:
 * - allPromised are all promised objects with a 'claim' (ie. Offer); note that some may be paid off
 * - allPaid are all paid objects with a 'claim' (ie. GiveAction)
 * - numStranges are recognized claims (ie. Offer, GiveAction) but missing some necessary fields
 * - numUnknowns are unrecognized claims (ie. not Offer or GiveAction)
 * - outstandingCurrencyTotals is a map of currency code to outstanding amount promised
 * - outstandingInvoiceTotals is a map of invoice ID (ie. offerId or recipient.identifier) to outstanding amount promised
 * - totalCurrencyPaid is a map of currency code to amount paid
 * - totalCurrencyPromised is a map of currency code to total amount promised
 *
 **/
export const countTransactions = (wrappedClaims, userDid: string) => {

  const SCHEMA_ORG = 'https://schema.org'

  // add up any promised amount or time values
  let allPaid = [];
  let allPromised = [];
  let numStranges = 0;
  let numUnknowns = 0;
  let outstandingCurrencyTotals = {} // map of currency code to outstanding amount promised
  let outstandingInvoiceTotals = {} // map of invoice ID to outstanding amount promised
  let totalCurrencyPaid = {} // map of currency code to amount paid
  let totalCurrencyPromised = {} // map of currency code to total amount promised
  const wrappedClaims2 = wrappedClaims.sort((j1, j2) => DateTime.fromISO(j1.issuedAt.replace(" ", "T")).toMillis() - DateTime.fromISO(j2.issuedAt.replace(" ", "T")).toMillis())
  for (jwtEntry of wrappedClaims2) {
    const claim = jwtEntry.claim;
    if (!claim) { numUnknowns++; continue; }
    const claimContext = claim['@context']
    if (!claimContext) { numUnknowns++; continue; }
    const claimType = claim['@type']
    if (!claimType) { numUnknowns++; continue; }

    if (claimContext === SCHEMA_ORG && claimType === 'Offer') {
      if (!claim.offeredBy && !claim.seller) { numStranges++; continue; }
      if ((claim.offeredBy && claim.offeredBy.identifier !== userDid)
          || (claim.seller && claim.seller.identifier !== userDid)) {
        numStranges++; continue;
      }
      const node = claim.itemOffered
      if (!node) { numStranges++; continue; }
      const amount = node.amountOfThisGood
      if (isNaN(amount)) { numStranges++; continue; }
      const currency = node.unitCode
      if (!currency) { numStranges++; continue; }
      const invoiceNum = claim.identifier || (claim.recipient && claim.recipient.identifier)

      if (!claim.validThrough || DateTime.fromISO(claim.validThrough) > DateTime.local()) {
        // this is still outstanding
        if (invoiceNum) {
          // there shouldn't be duplicates; we'll assume the last one is the most correct
          // ... but we probably won't test for this because it shouldn't be defined behavior
          if (outstandingInvoiceTotals[invoiceNum]) {
            // so if there is a previous invoice, we'll undo that one from the totals
            outstandingCurrencyTotals[currency] = (outstandingCurrencyTotals[currency] || 0) - outstandingInvoiceTotals[invoiceNum]
          }

          outstandingInvoiceTotals[invoiceNum] = amount
        }
        // with or without an invoice number, it's outstanding
        outstandingCurrencyTotals[currency] = (outstandingCurrencyTotals[currency] || 0) + amount
      }

      totalCurrencyPromised[currency] = (totalCurrencyPromised[currency] || 0) + amount
      allPromised = allPromised.concat([jwtEntry]);

    } else if (claimContext === SCHEMA_ORG && claimType === 'GiveAction') {
      if (!claim.agent || claim.agent.identifier !== userDid) {
        // just double-checking that this user really is the giver
        numStranges++; continue;
      }
      const node = claim.object
      if (!node) { numStranges++; continue; }
      const amount = node.amountOfThisGood
      if (isNaN(amount)) { numStranges++; continue; }
      const currency = node.unitCode
      if (!currency) { numStranges++; continue; }
      const invoiceNum = claim.offerId || (claim.recipient && claim.recipient.identifier)

      if (invoiceNum && outstandingInvoiceTotals[invoiceNum]) {
        // only decrement the promise if there's a tie to a known invoice or recipient
        const amountPaid = Math.min(amount, outstandingInvoiceTotals[invoiceNum])
        outstandingInvoiceTotals[invoiceNum] = outstandingInvoiceTotals[invoiceNum] - amountPaid
        outstandingCurrencyTotals[currency] = outstandingCurrencyTotals[currency] - amountPaid
      }

      totalCurrencyPaid[currency] = (totalCurrencyPaid[currency] || 0) + amount

      allPaid = allPaid.concat([jwtEntry]);

    } else {
      // unknown type, which we'll just ignore
      numUnknowns++
    }
  }

  return { allPaid, allPromised, numStranges, numUnknowns, outstandingCurrencyTotals, outstandingInvoiceTotals, totalCurrencyPaid, totalCurrencyPromised }

}
