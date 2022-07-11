# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).




## [Unreleased]




## [6.3.97] - 2022-05-10 - 509bebb07642488e97c0aad1f450376bdc245bea

### Added
- Run daily background task to detect new claims and alert user. (Still in testing. Android only.)

### Changed
- Improvments to credential presentation, including multiple QR codes to share.




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
