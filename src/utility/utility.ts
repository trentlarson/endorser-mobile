import { computePublicKey } from '@ethersproject/signing-key'
import { classToPlain } from 'class-transformer'
import crypto from 'crypto'
import * as didJwt from 'did-jwt'
import { DateTime } from 'luxon'
import MerkleTools from 'merkle-tools'
import matchAll from 'string.prototype.matchall'
import * as R from 'ramda'

import { Contact } from '../entity/contact'

export class EndorserRecord {
  id: string
  issuedAt: string
  issuer: string
  subject: string | null
  claimContext: string
  claimType: string
  claim: object // this is full object from the server, at least in /api/claim?... and /api/claim/ID
  hashHex: string
  hashChainHex: string | null // these eventually have an immutable value, but it may be empty for a while after recording
  jwtEncoded?: string // this may not be accessible by the current user/endpoint and thus may not be in result data
}

export class SignedSentResults {
  credential: object // the full credential (should always exist)
  jwt: string // signed JWT (should always exist)
  message: string // success or failure message (should always exist)
  serverId: string // may be missing if none was sent or there was an error
}

// This is used to check for hidden info.
// See https://github.com/trentlarson/endorser-ch/blob/0cb626f803028e7d9c67f095858a9fc8542e3dbd/server/api/services/util.js#L6
const HIDDEN_DID = 'did:none:HIDDEN'

export const DEFAULT_ANDROID_CHANNEL_ID = 'default-channel'
export const ENDORSER_JWT_URL_LOCATION = '/contact?jwt='
export const REPLACE_USER_DID_STRING = 'PUT_USER_DID'
export const SCHEMA_ORG_CONTEXT = 'https://schema.org'
export const UPORT_JWT_PREFIX = 'https://id.uport.me/req/'

export const ANDROID_FEED_ACTION = 'default' // only 'default' will launch the app if background / terminated on android

export const CLAIMS_HOME_SCREEN_NAV = 'Claims'
export const HELP_SCREEN_NAV = 'Help'
export const REPORT_FEED_SCREEN_NAV = 'Report Claims Feed'
export const REPORT_SCREEN_NAV = 'Reports from Endorser server'
export const REVIEW_SIGN_SCREEN_NAV = 'Review & Sign' // be sure to 'navigation.push' this to avoid data reuse

const merkler = new MerkleTools({ hashType: 'sha256' })

export function currencyShortWordForCode(unitCode) {
  return unitCode === 'HUR' ? 'hours' : unitCode
}

export function displayAmount(code, amt) {
  return '' + amt + ' ' + currencyShortWordForCode(code)
}

export function isDid(value) {
  return value && value.startsWith("did:") && (value.substring(5).indexOf(":") > -1)
}

export function rawAddressOfDid(did) {
  return did.split(":")[2]
}

// return first 3 chars + "..." + last 3 chars
const firstAndLast3 = (text) => {
  return text.length < 9 ? text : text.slice(0,3) + "..." + text.slice(-3)
}

export const isHiddenDid = (did) => {
  return did === HIDDEN_DID
}

export const isAccept = (claim) => {
  return claim && claim['@context'] === SCHEMA_ORG_CONTEXT && claim['@type'] === 'AcceptAction'
}

export const isContract = (claim) => {
  return claim && claim['@context'] === 'http://purl.org/cerif/frapo' && claim['@type'] === 'Contract'
}

export const isContractAccept = (claim) => {
  return isAccept(claim) && claim.object && isContract(claim.object)
}

export const isOffer = (claim) => {
  return claim && claim['@context'] === SCHEMA_ORG_CONTEXT && claim['@type'] === 'Offer'
}

export const isPlanAction = (claim) => {
  return claim && claim['@context'] === SCHEMA_ORG_CONTEXT && claim['@type'] === 'PlanAction'
}

/**
  templateIpfsCid is the IPFS ID of the contract template
  data is an object with all the private fields for the contract
 **/
export const constructContract = (templateIpfsCid, data) => {
  return {
    '@context': 'http://purl.org/cerif/frapo',
    '@type': 'Contract',
    contractFormIpfsCid: templateIpfsCid,
    fields: data,
  }
}

export const constructAccept = (agent, pledge) => {
  return {
    "@context": "https://schema.org",
    "@type": "AcceptAction",
    "agent": { identifier: agent },
    "object": pledge,
  }
}

// insert a space in front of any capital letters (and capitalize first letter, just in case)
// return '' for null or undefined input
export const capitalizeAndInsertSpacesBeforeCaps = (text) =>{
  return !text ? 'Something Unknown' : text[0].toUpperCase() + text.substr(1).replace(/([A-Z])/g, ' $1')
}

// return a space & claim number (1-based) for the index (0-based), or '' if there's only one
export const claimNumberText = (index, total, upperCase) => {
  let claimText = upperCase ? 'Claim' : 'claim'
  return claimText + (total === 1 ? '' : ' #' + (index+1))
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
      for (const value of input) {
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

const UNKNOWN_CONTACT = "Unknown Person"

/**
  always returns text; if unknown then it's UNKNOWN_CONTACT
 **/
export function didInfo(did, identifiers, contacts) {
  const myId = R.find(i => i.did === did, identifiers)
  if (myId) {
    return "You"
  } else {
    const contact = R.find(c => c.did === did, contacts)
    if (contact) {
      return contact.name || "(no name)"
    } else {
      return UNKNOWN_CONTACT
    }
  }
}

/**
 return readable summary of claim if possible
 **/
const claimSummary = (claim) => {
  if (claim.claim) {
    // probably a Verified Credential
    claim = claim.claim
  }
  let type = claim['@type'] || 'UnknownAction'
  return capitalizeAndInsertSpacesBeforeCaps(type)
}

/**
 return readable description of claim if possible, as a past-tense action

 identifiers is a list of objects with a 'did' field, each representhing the user
 contacts is a list of objects with a 'did' field for others and a 'name' field for their name
 **/
export const claimSpecialDescription = (record, identifiers, contacts) => {
  const claim = record.claim
  if (claim.claim) {
    // it's probably a Verified Credential
    claim = claim.claim
  }

  const issuer = didInfo(record.issuer, identifiers, contacts)
  const type = claim['@type'] || 'UnknownType'

  if (type === "AgreeAction") {
    return issuer + " agreed with a " + capitalizeAndInsertSpacesBeforeCaps(claim.object?.type)

  } else if (isAccept(claim)) {
    return issuer + " accepted a " + capitalizeAndInsertSpacesBeforeCaps(claim.object?.type)

  } else if (type === "JoinAction") {
    const contactInfo = didInfo(claim.agent.did, identifiers, contacts)

    let eventOrganizer = claim.event && claim.event.organizer && claim.event.organizer.name;
    eventOrganizer = eventOrganizer || "";
    let eventName = claim.event && claim.event.name;
    eventName = eventName ? " " + eventName : "";
    let fullEvent = eventOrganizer + eventName;
    fullEvent = fullEvent ? " attended the " + fullEvent : "";

    let eventDate = claim.event && claim.event.startTime;
    eventDate = eventDate ? " at " + eventDate : "";
    return contactInfo + fullEvent + eventDate;

  } else if (isOffer(claim)) {
    const contactInfo = didInfo(record.issuer, identifiers, contacts)
    let offering = ""
    if (claim.includesObject) {
      offering += " " + displayAmount(claim.includesObject.unitCode, claim.includesObject.amountOfThisGood)
    }
    if (claim.itemOffered?.description) {
      offering += " to " + claim.itemOffered?.description
    }
    return contactInfo + " offered" + offering

  } else if (type === "Tenure") {
    const contactInfo = didInfo(claim.party.did, identifiers, contacts)
    const polygon = claim.spatialUnit?.geo?.polygon || ""
    return contactInfo + " claimed [" + polygon.substring(0, polygon.indexOf(" ")) + "...]"

  } else {
    return claimSummary(claim, contacts)
  }
}

export const accessToken = async (identifier) => {
  const did: string = identifier.did
  const signer = didJwt.SimpleSigner(identifier.keys[0].privateKeyHex)

  const nowEpoch = Math.floor(Date.now() / 1000)
  const endEpoch = nowEpoch + 60 // add one minute

  const uportTokenPayload = { exp: endEpoch, iat: nowEpoch, iss: did }
  const alg = undefined // defaults to 'ES256K', more standardized but harder to verify vs ES256K-R
  const jwt: string = await didJwt.createJWT(uportTokenPayload, { alg, issuer: did, signer })
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

// assumes UTF-8 encoding
function sha256HexOfString(input: string): string {
  return sha256(Buffer.from(input, 'utf8')).toString('hex')
}

function sha256(input: Buffer): Buffer {
  return crypto.createHash('sha256').update(input).digest()
}

// improvement: taskyaml:endorser.ch,2020/tasks#migrate-pass-from-sha1
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

/**
 return subject of the claim if known; otherwise, null
 **/
const claimSubject = (claim) => {
  if (!claim) {
    return null
  }
  if (claim.claim) {
    // probably a Verified Credential
    claim = claim.claim
  }
  if (claim['@type'] === "AcceptAction") {
    return claim.agent && claim.agent.identifier
  } else if (claim['@type'] === "AgreeAction") {
    return claimSubject(claim.object)
  } else if (claim['@type'] === "DonateAction") {
    return claim.agent && claim.agent.identifier
  } else if (claim['@type'] === "Event") {
    return claim.agent && claim.agent.identifier
  } else if (claim['@type'] === "GiveAction") {
    return claim.agent && claim.agent.identifier
  } else if (claim['@type'] === "JoinAction") {
    return claim.agent && claim.agent.did
  } else if (claim['@type'] === "LoanOrCredit") {
    return claim.recipient && claim.recipient.identifier
  } else if (claim['@type'] === "Offer") {
    return claim.offeredBy && claim.offeredBy.identifier
  } else if (claim['@type'] === "Organization") {
    return claim.member && claim.member.member && claim.member.member.identifier
  } else if (claim['@type'] === "Person") {
    return claim.identifier
  } else if (claim['@type'] === "PlanAction") {
    return claim.agent && claim.agent.identifier
  } else if (claim['@type'] === "RegisterAction") {
    return claim.participant && claim.participant.did
  } else if (claim['@type'] === "Tenure") {
    return claim.party && claim.party.did
  }
  return null
}

export const vcPayload = (claim: any): JwtCredentialPayload => {
  return {
    sub: claimSubject(claim),
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

// uPort's QR code format
function uportJwtPayload(did, name, publicKeyHex) {
  const publicEncKey = Buffer.from(publicKeyHex, 'hex').toString('base64')
  return {
    iat: Date.now(),
    iss: did,
    own: {
      name,
      publicEncKey,
    },
  }
}

// returns null if the identifier doesn't have all necessary data
export const contactJwtForPayload = async (viewServer, identifier, name) => {
  // The public key should always exist, but we've seen Veramo weirdness
  // where an entry in the key table with a lowercase DID will be overwritten
  // by one with mixed case but the associated entry in the identifier table
  // will remain (so one identifier will not have an associated key). Ug.
  if (identifier.keys[0] && identifier.keys[0].publicKeyHex && identifier.keys[0].privateKeyHex) {
    const sharePayload = uportJwtPayload(identifier.did, name, identifier.keys[0].publicKeyHex)
    const newJwt = await createJwt(identifier, sharePayload)
    const viewPrefix =  viewServer + ENDORSER_JWT_URL_LOCATION
    const qrJwt: string = viewPrefix + newJwt
    return qrJwt
  } else {
    return null
  }
}

export const bvcClaim = (did: string, startTime: string) => {
  return {
    '@context': SCHEMA_ORG_CONTEXT,
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

// from Buffer to hex String (a quirky ethersproject function that I hope we fix)
export const pubHexFromBuf = (oldKeyBuf) => {
  // computePublicKey returns value with 0x on front
  let newKeyHex = computePublicKey(oldKeyBuf, true)
  if (newKeyHex.startsWith('0x')) {
    newKeyHex = newKeyHex.substring(2) // remove Ethereum prefix
  }
  return newKeyHex
}

// this is for some bad legacy data, removable when we have no deployments < 6.2
export const checkPubKeyBase64 = (oldKeyBase64) => {
  if (!oldKeyBase64) {
    return oldKeyBase64
  }
  const oldKeyBuf = Buffer.from(oldKeyBase64, 'base64')
  if (oldKeyBuf.length == 32) { // actually a private key
    const newKeyBase64 = Buffer.from(pubHexFromBuf(oldKeyBuf), 'hex').toString('base64')
    return newKeyBase64
  }
  return oldKeyBase64
}

/**
 @return results of Settings.uportJwtPayload:
   { iat: number, iss: string (DID), own: { name, publicEncKey (base64-encoded key) } }
 */
export const getContactPayloadFromJwtUrl = (jwtUrlText: string) => {
  let jwtText = jwtUrlText
  const endorserContextLoc = jwtText.indexOf(ENDORSER_JWT_URL_LOCATION)
  if (endorserContextLoc > -1) {
    jwtText = jwtText.substring(endorserContextLoc + ENDORSER_JWT_URL_LOCATION.length)
  } else if (jwtText.startsWith(UPORT_JWT_PREFIX)) {
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
 * - idsOfStranges are recognized claims (ie. Offer, GiveAction) but missing some necessary fields
 * - idsOfUnknowns are unrecognized claims (ie. not Offer or GiveAction)
 * - outstandingCurrencyTotals is a map of currency code to outstanding amount promised
 * - outstandingInvoiceTotals is a map of
 *     invoice ID (ie. offerId or recipient.identifier) to outstanding amount promised
 * - totalCurrencyPaid is a map of currency code to amount paid
 * - totalCurrencyPromised is a map of currency code to total amount promised
 *
 **/
export const countTransactions = (wrappedClaims, userDid: string) => {

  // add up any promised amount or time values
  let allPaid = [];     // full claim details
  let allPromised = []; // full claim details
  let idsOfStranges = [];
  let idsOfUnknowns = [];
  let outstandingCurrencyTotals = {} // map of currency code to outstanding amount promised
  let outstandingInvoiceTotals = {} // map of invoice ID to outstanding amount promised
  let totalCurrencyPaid = {} // map of currency code to amount paid
  let totalCurrencyPromised = {} // map of currency code to total amount promised
  const wrappedClaims2 =
    wrappedClaims.sort((j1, j2) =>
      DateTime.fromISO(j1.issuedAt.replace(" ", "T")).toMillis()
      - DateTime.fromISO(j2.issuedAt.replace(" ", "T")).toMillis()
    )
  for (const jwtEntry of wrappedClaims2) {
    const claim = jwtEntry.claim;
    if (!claim) { idsOfUnknowns.push(jwtEntry.id); continue; }
    const claimContext = claim['@context']
    if (!claimContext) { idsOfUnknowns.push(jwtEntry.id); continue; }
    const claimType = claim['@type']
    if (!claimType) { idsOfUnknowns.push(jwtEntry.id); continue; }

    if (claimContext === SCHEMA_ORG_CONTEXT && claimType === 'Offer') {
      if (!claim.offeredBy && !claim.seller) { idsOfStranges.push(jwtEntry.id); continue; }
      if ((claim.offeredBy && claim.offeredBy.identifier !== userDid)
          || (claim.seller && claim.seller.identifier !== userDid)) {
        idsOfStranges.push(jwtEntry.id); continue;
      }

      let node = claim.includesObject
      if (!node && claim.itemOffered?.amountOfThisGood) {
        // this is the case for some legacy Offer entries on endorser.ch
        node = claim.itemOffered
      }

      if (!node) { idsOfStranges.push(jwtEntry.id); continue; }
      const amount = node.amountOfThisGood
      if (isNaN(amount)) { idsOfStranges.push(jwtEntry.id); continue; }
      const currency = node.unitCode
      if (!currency) { idsOfStranges.push(jwtEntry.id); continue; }
      const invoiceNum = claim.identifier || claim.recipient?.identifier

      if (!claim.validThrough || DateTime.fromISO(claim.validThrough) > DateTime.local()) {
        // this is still outstanding
        if (invoiceNum) {
          // there shouldn't be duplicates; we'll assume the last one is the most correct
          // ... but we probably won't test for this because it shouldn't be defined behavior
          if (outstandingInvoiceTotals[invoiceNum]) {
            // so if there is a previous invoice, we'll undo that one from the totals
            outstandingCurrencyTotals[currency] =
              (outstandingCurrencyTotals[currency] || 0) - outstandingInvoiceTotals[invoiceNum]
          }

          outstandingInvoiceTotals[invoiceNum] = amount
        }
        // with or without an invoice number, it's outstanding
        outstandingCurrencyTotals[currency] = (outstandingCurrencyTotals[currency] || 0) + amount
      }

      totalCurrencyPromised[currency] = (totalCurrencyPromised[currency] || 0) + amount
      allPromised = allPromised.concat([jwtEntry]);

    } else if (claimContext === SCHEMA_ORG_CONTEXT && claimType === 'GiveAction') {
      if (!claim.agent || claim.agent.identifier !== userDid) {
        // just double-checking that this user really is the giver
        idsOfStranges.push(jwtEntry.id); continue;
      }
      const node = claim.object
      if (!node) { idsOfStranges.push(jwtEntry.id); continue; }
      const amount = node.amountOfThisGood
      if (isNaN(amount)) { idsOfStranges.push(jwtEntry.id); continue; }
      const currency = node.unitCode
      if (!currency) { idsOfStranges.push(jwtEntry.id); continue; }
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
      idsOfUnknowns.push(jwtEntry.id)
    }
  }

  return {
    allPaid, allPromised, idsOfStranges, idsOfUnknowns,
    outstandingCurrencyTotals, outstandingInvoiceTotals,
    totalCurrencyPaid, totalCurrencyPromised
  }

}

/**
 * return Promise of
 *   jwts: array of EndorserRecord objects
 *   hitLimit: boolean telling whether there may be more
 */
export const retrieveClaims = async (endorserApiServer, identifier, afterId, beforeId) => {
  const token = await accessToken(identifier)
  const afterQuery = afterId == null ? '' : '&afterId=' + afterId
  const beforeQuery = beforeId == null ? '' : '&beforeId=' + beforeId
  return fetch(endorserApiServer + '/api/v2/report/claims?' + afterQuery + beforeQuery, {
    method: 'GET',
    headers: {
      "Content-Type": "application/json",
      "Uport-Push-Token": token,
    }
  }).then(response => {
    if (response.status !== 200) {
      throw Error('There was a low-level error from the server.')
    }
    return response.json()
  }).then(results => {
    if (results.data) {
      return results
    } else {
      throw Error(results.error || 'The server got an error. (For details, see the log on the Settings page.)')
    }
  })
}

/**
  Here's a little shared variable, eg. so that iOS can kill our background process when it wants.
 **/
export const Toggle = () => {
  let toggle = false
  return {
    setToggle: (value) => toggle = value,
    getToggle: () => toggle,
  }
}

const PREFIX_DELIM = '{{'
const POSTFIX_DELIM = '}}'

// returns array of all fields in contractTextsurrounded by field delimteres, preserving order
export const fieldKeysInOrder: Array<string> = (contractText) => {
  // javascript documentation implies that matches really do happen in order of appearance in the text
  const fieldRegex = new RegExp(PREFIX_DELIM + ".*?" + POSTFIX_DELIM, 'g')
  const fields = [...matchAll(contractText, fieldRegex)].flat()
  const fieldKeys =
    R.uniq(fields).map(s => s.slice(PREFIX_DELIM.length).slice(0, -POSTFIX_DELIM.length))
  return fieldKeys
}

// returns fieldValues object with keys in the order they appear in contractText
export const fieldsInsertionOrdered: Array<string> = (contractText, fieldValues) => {
  const fieldKeys = fieldKeysInOrder(contractText)
  const result = {}
  for (const key of fieldKeys) {
    if (fieldValues[key]) {
      result[key] = fieldValues[key]
    }
  }
  return result
}

/**
  Create the merkle tree root hex from a contract-value object, or null
 **/
export const valuesMerkleRootHex = (dataObj) => {
  merkler.resetTree()
  // strip whitespace just to be doubly sure
  const values = R.values(dataObj).map(R.trim)

  //merkler.addLeaves(values, true) // works when I run in the tests but not in emulator!? "Error: Bad hex value"
  for (const value of values) {
    //merkler.addLeaf(value, true) // works when I run in the tests but not in emulator!? "Error: Bad hex value"
    merkler.addLeaf(sha256HexOfString(value))
  }
  merkler.makeTree(false)
  const root = merkler.getMerkleRoot()
  const result = root ? root.toString('hex') : null
  return result
}

/**
  Create the YAML prefix from the fields.
  Note that whitespace around each value will be stripped.
 **/
export const contractPrefix = (fields) => {
  let prefix = '---\n'
  for (const key of R.keys(fields)) {
    let value = fields[key]
    value = value.trim()
    if (value.match('\n')) {
      value = '|-\n' + value
      value = value.replace(/\n/g, '\n  ')
    } else {
      value = value.replace(/"/g, '\\"')
      value = '"' + value + '"'
    }
    value = value + '\n'
    prefix += key + ': ' + value
  }
  return prefix
}

/**
  Create the hash hex from contract values & template.
 **/
export const contractHashHex = (fields, templateText) => {
  return sha256HexOfString(contractPrefix(fields) + '---\n' + templateText)
}
