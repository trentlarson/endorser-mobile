import { classToPlain } from 'class-transformer'
import * as didJwt from 'did-jwt'
import * as R from 'ramda'

import { Contact } from '../entity/contact'

// This is used to check for hidden info.
// See https://github.com/trentlarson/endorser-ch/blob/0cb626f803028e7d9c67f095858a9fc8542e3dbd/server/api/services/util.js#L6
const HIDDEN_DID = 'did:none:HIDDEN'

//export const DEFAULT_ENDORSER_API_SERVER = 'https://endorser.ch:3000'
//export const DEFAULT_ENDORSER_VIEW_SERVER = 'https://endorser.ch'
export const DEFAULT_ENDORSER_API_SERVER = 'http://10.0.0.88:3000'
export const DEFAULT_ENDORSER_VIEW_SERVER = 'http://10.0.0.88:3001'
//export const DEFAULT_ENDORSER_API_SERVER = 'http://127.0.0.1:3000'
//export const DEFAULT_ENDORSER_VIEW_SERVER = 'http://127.0.0.1:3001'
//export const DEFAULT_ENDORSER_API_SERVER = 'http://192.168.43.114:3000'
//export const DEFAULT_ENDORSER_VIEW_SERVER = 'http://192.168.43.114:3001'

export const TEST_MODE = true

export const ENDORSER_JWT_URL_LOCATION = '/contact?jwt='

function isDid(value) {
  return value && value.startsWith("did:") && (value.substring(5).indexOf(":") > -1)
}

// return first 3 chars + "..." + last 3 chars
const firstAndLast3 = (text) => {
  return text.slice(0,3) + "..." + text.slice(-3)
}

export const isHiddenDid = (did) => {
  return did === HIDDEN_DID
}

// return true for any nested string where func(input) === true
function testRecursivelyOnString(func, input) {

  if (Object.prototype.toString.call(input) === "[object String]") {
    return func(input)

  } else if (input instanceof Object) {

    var result = []
    if (!Array.isArray(input)) {
      // it's an object
      for (key in input) {
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
  if (!isDid(did)) {
    return did
  } else if (isHiddenDid(did)) {
    return "(HIDDEN)"
  } else {
    return firstAndLast3(did.split(":")[2].substring(2))
  }
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

function didInContext(did, identifiers, contacts) {
  return firstAndLast3OfDid(did) + " (" + didInfo(did, identifiers, contacts) + ")"
}

export const claimDescription = (claim, identifiers, contacts) => {
  if (claim.claim) {
    // probably a Verified Credential
    claim = claim.claim
  }
  let type = claim['@type']
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
    return contactInfo + fullEvent + eventDate;
  } else if (type === "Tenure") {
    var polygon = claim.spatialUnit.geo.polygon
    return didInContext(claim.party.did, identifiers, contacts) + " holding [" + polygon.substring(0, polygon.indexOf(" ")) + "...]"
  } else {
    return JSON.stringify(claim)
  }
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

export const createJwt = async (identifier: IIdentifier, payload: any): string => {
  const signer = didJwt.SimpleSigner(identifier.keys[0].privateKeyHex)
  const did: string = identifier.did
  return didJwt.createJWT(payload,{ issuer: did, signer })
}
