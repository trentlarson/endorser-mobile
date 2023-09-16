# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).




## [Unreleased]

### Nothing Yet


## [6.7.131] - 2023-09-16

### Changed
- Changed prod API URL from port 3000 to api.endorser.ch
- Changed default derivation path from uPort's default to our own



## [6.7.129] - 2023-07-21 - 9faa71a42b510ee5c1585db208a61533d4bd1118

### Added
- Bookmarks of plans and projects
- For provider plan/project, a count of gives assisted by them on the verify screen



## [6.7.128] - 2023-06-18 - 3935452c8eb3abe9253a56e1ea229e17a8bb910b

### Added
- Providers for gives
- Edit of credentials
- Three Lives of Gifts pledges, with the first one edited
- Option for 'Gave' button on the home screen

### Fixed
- 'Load More' button at the bottom of lists is now always visible.



## [6.7.126] - 2023-04-28 - ffa7f5da0e1eb699c9f911a0234268e8a47f2be7

### Added
- Common-contact discovery from lists of claims



## [6.6.125] - 2023-04-16 - d64db5871d854886cf66483a6d27d44e7da34ff7

### Added
- Gives & offers on plans
- ID for BVC-specific time donations
- Common-contact discovery

### Fixed
- Verifiable presentation scanning
- Give & offer creation and iOS list scrolling



## [6.5.120] - 2023-03-08 - 27ae1b40b780020dfc1976d62c3a1b0ec4825697

### Added
- Targeted feed showing only gives/offers/plans by those in contact list
- Schema addition: Offer actionAccessibilityRequirement requiresOffers & requiresOffersTotal for thresholds for an offer




## [6.4.118] - 2023-02-10 - f461d0e7639591ec106b3a1dd1a30713e43e2caa

### Changed
- Schema change: Offer.offeredBy type changed from string to object with 'identifier' property.
- Schema change: Offer.orderId renamed to 'fulfills' and changed from string to object with 'identifier' property.

### Fixed
- Adjust Offer and GiveAction data and display.
- Gather valid data for Agree links.

### Deleted
- Removed the marker to transfer offers.




## [6.4.113] - 2023-02-02 - 6720ae87db490965d4db4a253b7003f211b7ec8a

### Added
- Collapsed details & actions for lists of claims, and better descriptions.
- Added more details to input in Plans & Projects.
- Match the updated schema for Plans & Projects.
- Enhance error messages, especially for claim and registration limits.

### Fixed
- Don't resubmit to server when tabbing back to result page.
- Fix display elements for no identifier or new identifier.




## [6.3.108] - 2022-11-21 - 6c7b958d167d73ca0ff568f22c39bbd6270d8b9a

### Fixed
- Scan QR codes for claims and contacts.




## [6.3.106] - 2022-10-31 - 6d2d8973a917f0243d8b0c4bc5152fc979870326

### Fixed
- Contract-parsing error that crashed Android.




## [6.3.104] - 2022-10-10 - afbc95215ad55c5eb057410c5a3a870796c3920c

### Added
- Create contracts with private data.
- Send contact registrations.




## [6.3.103] - 2022-08-25 - 64bdf912703595ef42503545784c61a282b80a7a

Released

### Added
- Message for notification permissions on front page.




## [6.3.102] - 2022-08-07 - 476b67124bfdee7dd896ccc07d58010fc57d0945

### Added
- Feed, with notifications on new claims.
- Persisted choice of endorser server.

### Changed
- API for paged query returns hitLimit boolean instead of maybeMoreAfter string.




## [6.3.97] - 2022-05-10 - 509bebb07642488e97c0aad1f450376bdc245bea

### Added
- Run daily background task to detect new claims and alert user. (Still in testing. Android only.)

### Changed
- Improvements to credential presentation, including multiple QR codes to share.




## [6.2.87] - 2022-05-10 - 03f167e3d7c43e93e2e1da2ef7b83218633c7a5b

### Added
- Allow display of private key.




## [6.1.85] - 2022-04-26 - f43e4bfedade82886de3fb2e7d515d44b89011c8

### Changed
- Added Mutual Integrity Pledge, and pledge descriptions.

### Fixed
- Fix some display elements for transactional claims.




## [6.1.84] - 2022-03-27 - 395e7770b4dd78bf150d87fea27006bcaae46ad4

### Changed
- Send multiple confirmations & claims separately (instead of as one array of claims).

### Fixed
- Fix references to schema.org to be HTTPS.




## [6.1.83] - 2022-03-22 - 0bb6772cd21cfd8004f496894cbd59c33b6decd8

### Added
- Scan a template to create a claim.
- Import contacts in bulk via URL.

### Changed
- Move contact creation data entry (by URL or by hand) into modals.




## [6.1.80]
## [6.1.79] - 2022-02-27 - 21ddc5327c44aee36656f213d1fee1a2b286ff1b

### Added
- Add totals for transactional claims of Offer & GiveAction.
- Allow 'Check' on search results, and show claim ID on Verify screen.
- Confirm before deleting identifiers and contacts.

### Changed
- Format more results in YAML.




## [6.0.17] - 2022-01-17 - 52bc890dc8d8c54575908a0fb66c67a4aa8e8952

### Added
- Encrypt mnemonic seed phrase
- Show derivation path
- Bulk CSV contact export and import
- Edit a contact name.
- Links in search results, to show DID contact info & linked "visible" intermediate DID info
- YAML format for search results
- Drop-down contact selection for DID inputs on claims
- Custom home screen for one organization




## [6.0.15]

### Added
- Add verifiable presentations
- Add pledges, including time and money




## [6.0.7]

### Added
- More Logging on Settings page

### Fixed
- QR code generation and detection for test servers




## [6.0.3]

### Changed
- Platform-specific links to App Store & Play Store




## [0.0.1] - 2021-03-21

### Added
- Basic functions to create an identity, make claims, and store contacts
