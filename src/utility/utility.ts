
// This is used to check for hidden info.
// See https://github.com/trentlarson/endorser-ch/blob/0cb626f803028e7d9c67f095858a9fc8542e3dbd/server/api/services/util.js#L6
const HIDDEN_DID = 'did:none:HIDDEN'

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
  if (isHiddenDid(did)) {
    return "(HIDDEN)"
  } else {
    return firstAndLast3(did.split(":")[2].substring(2))
  }
}

export const claimDescription = (claim) => {
  if (claim.claim) {
    // probably a Verified Credential
    claim = claim.claim
  }
  let type = claim['@type']
console.log('description for ', claim)
  if (type === "JoinAction") {
    let eventOrganizer = claim.event && claim.event.organizer && claim.event.organizer.name;
    eventOrganizer = eventOrganizer ? eventOrganizer : "";
    let eventName = claim.event && claim.event.name;
    eventName = eventName ? " " + eventName : "";
    let fullEvent = eventOrganizer + eventName;
    fullEvent = fullEvent ? " at " + fullEvent : "";
    let eventDate = claim.event && claim.event.startTime;
    eventDate = eventDate ? " at " + eventDate : "";
    return firstAndLast3OfDid(claim.agent.did) + fullEvent + eventDate;
  } else if (type === "Tenure") {
    var polygon = claim.spatialUnit.geo.polygon
    return firstAndLast3OfDid(claim.party.did) + " holding [" + polygon.substring(0, polygon.indexOf(" ")) + "...]"
  } else {
    return JSON.stringify(claim)
  }
}
