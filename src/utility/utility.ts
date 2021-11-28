import { classToPlain } from 'class-transformer'
import crypto from 'crypto';
import * as didJwt from 'did-jwt'
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

// This is currently a rather expensive implementation.
export const containsHiddenDid = (obj) => {
  return testRecursivelyOnString(str => str === HIDDEN_DID, obj)
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
  const lastChars = did.split(":")[2]
  if (!lastChars) {
    return firstAndLast3(did.substring("did:".length))
  }
  if (lastChars.startsWith("0x")) { // Ethereum DIDs
    return firstAndLast3(lastChars.substring(2))
  }
  return firstAndLast3(lastChars)
}

const UNKNOWN_CONTACT = "?"

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
  return shortName + " (" + visibleDid + ")"
}

/**
 return readable description of claim if possible
 identifiers is a list of objects with a 'did' field, each representhing the user
 contacts is a list of objects with a 'did' field for others and a 'name' field for their name
 extraTitle is optional
 **/
export const claimDescription = (claim, identifiers, contacts, extraTitle) => {
  if (claim.claim) {
    // probably a Verified Credential
    claim = claim.claim
  }
  let type = claim['@type'] || 'UnknownType'
  let prefix = capitalizeAndInsertSpacesBeforeCaps(type) + (extraTitle || '') + '\n'

  let details
  if (type === "JoinAction") {
    const contactInfo = didInContext(claim.agent.did, identifiers, contacts)
    let eventOrganizer = claim.event && claim.event.organizer && claim.event.organizer.name;
    eventOrganizer = eventOrganizer ? eventOrganizer : "";
    let eventName = claim.event && claim.event.name;
    eventName = eventName ? " " + eventName : "";
    let fullEvent = eventOrganizer + eventName;
    fullEvent = fullEvent ? " at " + fullEvent : "";
    let eventDate = claim.event && claim.event.startTime;
    eventDate = eventDate ? " at " + eventDate : "";
    details = contactInfo + fullEvent + eventDate;
  } else if (type === "Tenure") {
    var polygon = claim.spatialUnit.geo.polygon
    details = didInContext(claim.party.did, identifiers, contacts) + " holding [" + polygon.substring(0, polygon.indexOf(" ")) + "...]"
  } else {
    details = JSON.stringify(claim)
  }
  return prefix + details
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
    const foundContacts = await conn.manager.find(Contact, {order: {name:'ASC'}})
    await appStore.dispatch(appSlice.actions.setContacts(classToPlain(foundContacts)))
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
