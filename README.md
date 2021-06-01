
# Endorser Mobile

A mobile app for recording claims and reporting on them

For the reporting facility, we use the [endorser-ch APIs](https://github.com/trentlarson/endorser-ch).



## Dev Build & Run

`yarn install`

Run ios:

`cd ios; pod install; cd ..`

`yarn run ios`

(If there's a complaint about Metro, `yarn start` before that.)

Run android:

`yarn run android`

Clean:

`./node_modules/.bin/react-native-clean-project`




## Test

- Without an Endorser.ch server
  - Create IDs, export, and import.
  - Create contacts.
- With an Endorser.ch server
  - On a public test server
    - Run in Test Mode (under Settings) and click the button to choose the test server.
  - On your machine
    - Run endorser-ch test/test.sh, then copy the endorser-ch-test-local.sqlite3 to endorser-ch-dev.sqlite3, then run the server.
  - Import via the mnemonic, eg. #3 from endorser-ch test/util.js
  - Submit claims & confirmations.
  - Run report searches for the individual, eg. for 'carp'



## Package & Deploy

To Do First Release:

- Android
  - In the android folder, put pc-api-7249509642322112640-286-534d849dfda0.json
  - In the android/app folder, put google-comm-endo-upload-key.keystore
- Figure out Apple signing.  (Sorry, I don't remember that part.)


To Release:

- In package.json, update version
- In src/veramo/appSlice.ts: servers are endorser.ch
- android
  - In node_modules/@veramo/data-store, all Entity() calls need the name inside.
  - In android/app/build.gradle, update versionName (to match version in package.json) & versionCode (with build number)
    - Always increment the versionCode.  It is possible to reuse the versionName.
  - `cd android; bundle exec fastlane beta; cd ..`
  - To create a new release & upload:
    - Do one of these in Google Play Console:
      - In Internal testing, "Edit release", or
      - In Production, "Create new release" or "Edit release", or
      - In "Releases overview" under "Latest releases" click arrow on right of next release. (When do we see this?)
    - After uploading, "Save", "Review Release", then "Rollout to internal testing" or "Rollout to Production".
- ios
  - In ios/EndorserMobile/Info.plist, update CFBundleShortVersionString to match version in package.json
  - (Note that CFBundleVersion is done by fastlane beta.)
  - `cd ios; bundle exec fastlane beta; cd ..`
  - To create a new release
    - Have a test build?  IDK... maybe don't click 'Expire'
    - In App Connect -> App Store next to iOS App, click the "+"
    - Under App description next to "Build" and to the right, click the red icon to remove that version, then add another version.
    - Submit it for review, and after they approve the review then you can test in TestFlight or release.
  - Screenshot on different simulator: `yarn run ios --simulator="iPhone 8"`
    6.5" (eg. iPhone 11)
    take at 361x780 then scale to 1284x2778 (exactly)
    5.5" (eg. iPhone 8)
    ... 361x642 or 400x712 ... 1242x2208 (exactly)
  - Add screenshots to version control.

- ... and after that upload:
  - Make sure to commit those changes to git.
  - Bump the version in: package.json

- ... and if it's a final release:
  - Bump the version (eg to "-rc") in: package.json, android/app/build.gradle, ios/EndorserMobile/Info.plist
