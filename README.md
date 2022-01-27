
# Endorser Mobile

A mobile app for recording claims and reporting on them

For the reporting facility, we use the [endorser-ch APIs](https://github.com/trentlarson/endorser-ch).



## Dev Build & Run

`yarn install`

Run ios:

`cd ios; pod install; cd ..`

`yarn run ios`

(If there's a complaint about Metro, `yarn start` before that, maybe with the `--reset-cache` flag.)

Run android:

`yarn run android`

Clean:

`yarn run clean`

... but note that answering "Y" to install pods sometimes doesn't actually install pods (?!) and you may have to `pod install` that by hand.

Troubleshooting:

- A "CompileC" error can happen after removing a dependency. You may have to manually remove node_modules and pods (both `ios/Pods` and `~/Library/Caches/CocoaPods`) and reinstall them... but even that may not work and sometimes I just clone a new copy and installe anew.


```
watchman watch-del-all
rm -rf /tmp/metro-*
rm -rf ~/Library/Caches/CocoaPods ios/Pods
cd ios; pod install; cd ..
rm -rf node_modules
yarn install
yarn start --reset-cache # which you'll have to kill because it doesn't stop
```


### Create a New DB Migration

`cd src/migration`
`npx typeorm migration:create -n YourMigrationName`

... and edit it to include a field: 'public name = "ClassName...789"'
... and edit src/veramo/setup.js and add import for that file and add to `migrations` (and add to ALL_ENTITIES if there's a new table)



## Test

Automatically with: `yarn test`

... but note:

- The App-test.js fails. Haven't had time to look into it.
- It requires node v14+. (I don't know why `yarn run ios` works but the tests don't.) (If you want a hack for v12, change the `??` to a `||` in node_modules/did-jwt/lib/index.js)

Manually

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
- On an actual device (remember the table-name fiasco!)
  - Android - must use Play Store to release to internal testing (because fiasco wasn't caught when connected)
    - To work with different versions, increment versionCode in different clones of the repo (built from scratch), and test in Internal Testing with alternating builds & uploads.
  - iOS - TestFlight is recommended (though potentially OK to use Xcode, since it would have caught the fiasco)



## Package & Deploy

To Do First Release:

- Android
  - In the android/app folder, put pc-api-....json and google-comm-endo-upload-key.keystore
- Figure out Apple signing.  (Sorry, I don't remember that part.)


To Release:

- Test everything.
- In package.json, update version
- Tag
- In src/veramo/appSlice.ts: check that servers are endorser.ch
- (I recommend starting with ios since it takes longer to get approved.)
- android
  - In android/app/build.gradle, update versionName (to match version in package.json) & versionCode (with build number to match ios)
    - Always increment the versionCode (and ensure you don't already have a larger release in ios just for consistency's sake).  It is possible to reuse the versionName.
  - `cd android; bundle exec fastlane beta; cd ..`
    - It will prompt for credentials.
    - For error: "Keystore file 'endorser-mobile/android/fastlane/../app/google...keystore' not found for signing config 'externalOverride'."
      - Put the google...keystore file in place.
    - For error: "Google Api Error: forbidden: The caller does not have permission"
      - Check that the pc-api...json file is in place. Also go to Console -> Setup -> API access and find that Service Account key, then Grant Access.
  - To create a new release & upload:
    - Do one of these in Google Play Console:
      - In Internal testing, "Edit release", or
      - In Production, "Create new release" or "Edit release", or
      - In "Releases overview" under "Latest releases" click arrow on right of next release. (When do we see this?)
    - After uploading, "Save", "Review Release", then "Rollout to internal testing" or "Rollout to Production".
- ios
  - In ios/EndorserMobile/Info.plist, update CFBundleShortVersionString to match version in package.json
  - Make the CFBundleVersion one less than the versionCode in the android/app/build.gradle. (Note that it is automatically incremented by fastlane beta.) (Remember this when building; it changes.)
  - Create a release in App Store Connect
    - Have a test build?  IDK... maybe don't click 'Expire'
    - For a new one: in App Connect -> App Store next to iOS App, click the "+"
    - For an existing one: under "Build" and all the way to the right of the number (which you have to mouse-over to see), click the red icon to remove that version, then add another version.  Also change the "Version" in the field below the icons.

  - Build & upload to App Store Connect
    - The following might require that you first create the new release version in the appstoreconnect.apple.com
    - `cd ios; bundle exec fastlane beta; cd ..`
    - This takes about 30 minutes. The upload takes about 10 at the end; there's no prompt after requesting the 6-digit code.
    - After entering the 6-digit code (in about 18 minutes), it should say "Login Successful". It failed when I was on a VPN... maybe because I hadn't created the version in the App Store yet.
  - Submit the release for review (by filling in the "What's New" and "Notes"), and after they approve the review then you can test in TestFlight or release.
  - Screenshot on different simulator: `yarn run ios --simulator='iPhone 8' (also 'iPhone 5.5"')
    6.5" (eg. iPhone 11) taken at 361x780 then scaled to 1284x2778 (exactly)
    5.5" (eg. iPhone 8) ... 361x642 or 400x712 ... 1242x2208 (exactly)
  - Add screenshots to version control in endorser-mobile-assets

- ... and after that upload:
  - update CHANGELOG commit hash.
  - Make sure to commit those changes to git.
  - Bump the version in: package.json

- ... and if it's a final release:
  - Bump the version (eg to "-rc") in: package.json, android/app/build.gradle, ios/EndorserMobile/Info.plist
