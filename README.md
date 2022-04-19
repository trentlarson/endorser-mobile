
# Endorser Mobile

A mobile app for recording claims and reporting on them

For the reporting facility, we use the [endorser-ch APIs](https://github.com/trentlarson/endorser-ch).



## Dev Build & Run

`yarn install`

Note that there are also some other mobile dependencies, eg. iOS CocoaPods and Android Studio. The tools will prompt you along the way.

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

- This error comes when there is no internet connection, especially when run locally.

```
(node:54926) UnhandledPromiseRejectionWarning: TypeError: Converting circular structure to JSON
    --> starting at object with constructor 'XMLHttpRequest'
    |     property 'upload' -> object with constructor 'XMLHttpRequestUpload'
    --- property '_request' closes the circle
    at JSON.stringify (<anonymous>)
    at /Users/tlarson/dev/home/endorser-ch/node_modules/ethjs-query/lib/index.js:108:99
    at processTicksAndRejections (internal/process/task_queues.js:93:5)
(node:54926) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). (rejection id: 1)
```

- There can be Pod errors by Flipper or YogaKit, or something in XCode about missing `event2/event-config.h`. For example:

```
The following build commands failed:
	CompileC /Users/tlarson/Library/Developer/Xcode/DerivedData/EndorserMobile-bxlugkhkwnymbefkkpzsanthvihl/Build/Intermediates.noindex/Pods.build/Debug-iphonesimulator/Flipper.build/Objects-normal/x86_64/FlipperRSocketResponder.o /Users/tlarson/dev/home/endorser-mobile/ios/Pods/Flipper/xplat/Flipper/FlipperRSocketResponder.cpp normal x86_64 c++ com.apple.compilers.llvm.clang.1_0.compiler (in target 'Flipper' from project 'Pods')
(1 failure)
```

We've fixed the `use_flipper` call in ios/Podfile for some platforms. But if it still doesn't work you might remove all those flipper references in Podfile, remove Podfile.lock and Pods, and `pod install` again.


## Create a New DB Migration

`cd src/migration`
`npx typeorm migration:create -n YourMigrationName`

... and edit it to include a field: 'public name = "ClassName...789"'
... and edit src/veramo/setup.js and add import for that file and add to `migrations` (and add to ALL_ENTITIES if there's a new table)



## Test

Automatically with: `yarn test`

... but note:

- The App-test.js fails with "NativeModule.RNPermissions is null". I've tried but failed with the recommendation here: https://github.com/zoontek/react-native-permissions#testing-with-jest

Manually

- Without an Endorser.ch server
  - Create IDs, export, and import.
  - Create contacts.
- With an Endorser.ch server
  - On a public test server
    - Run in Test Mode (under Settings & Advanced Mode) and click the button to choose the test server.
  - On your machine
    - Run endorser-ch test/test.sh, then copy the endorser-ch-test-local.sqlite3 to endorser-ch-dev.sqlite3, then run the server.

  - Create an identifier & add name.
  - As a second user, import via the mnemonic, eg. #3 from endorser-ch test/util.js

  - Submit a claim. Run search for this individual's claims, and then for all claims.
  - As a second user, check that they cannot see the claim details.
  - As a third user, check that they cannot see the claim details.
  - As a fourth user, check that they cannot see the claim details.

  - As the second and third user, share contact info.
  - As the initial user, allow the second and third user to see them.
  - As the second user, check that they can see the claim details.
  - As the fourth user, check that they can access people in their network who can get to the claim.

  - As the third user, check that they can confirm the first claim.
  - As the fourth user, check that they can see people in their network who can get to the confirmation info.

  - As the third user, check that they cannot see the claim details but can see a link.
  - As the second user, submit confirmation.

  - Create an Offer, show total outstanding, mark as given, see adjustment of totals.

- On an actual device (remember the table-name fiasco!)
  - Android - must use Play Store to release to internal testing (because fiasco wasn't caught when connected)
    - To work with different versions, increment versionCode in different clones of the repo (built from scratch), and test in Internal Testing with alternating builds & uploads.
  - iOS - TestFlight is recommended (though potentially OK to use Xcode, since it would have caught the fiasco)





## Package & Deploy

To Do First Release:

- Android
  - In the android/app folder, put pc-api-....json and google-comm-endo-upload-key.keystore
- Configure Apple signing.
  - To renew certificate: https://developer.apple.com/account/resources/certificates/list
    ... and make one for Apple Distribution
    ... and also Apple Development (not sure about iOS App Development or iOS App Distribution)
    ... and add a new Provisioning Profile - for Development (and maybe iOS App Development), selecting the Dev cert
    ... and possibly restart Xcode. (Yes, that make it work after these errors: "Provisioning profile... doesn't include signing certificate")



To Release:

- Test everything.
- In package.json, update version
- Tag
- In src/veramo/appSlice.ts: check that servers are endorser.ch
- (I recommend starting with ios since it takes longer to get approved.)
- android
  - In android/app/build.gradle, update versionName (to match version in package.json) & versionCode (with build number to match ios)
    - Always increment the versionCode (and ensure you don't already have a larger release in ios, just for consistency's sake).  It is possible to reuse the versionName.
  - `cd android; bundle exec fastlane beta; cd ..`
    - It will prompt for credentials almost immediately.
    - For error: "Keystore file 'endorser-mobile/android/fastlane/../app/google...keystore' not found for signing config 'externalOverride'."
      - Put the google...keystore file in place.
    - For error: "Google Api Error: forbidden: The caller does not have permission"
      - Check that the pc-api...json file is in place. Also go to Console -> Setup -> API access and find that Service Account key, then Grant Access.
  - To create a new release & upload:
    - Do one of these in Google Play Console:
      - In Internal testing, "Edit release", or
      - In Production, "Create new release" or "Edit release", or
      - In "Releases overview" under "Latest releases" click arrow on right of next release. (When do we see this?)
    - After uploading, "Save", "Review Release", then "Rollout to internal testing".
    - Test
      - First check the old version with existing data on a device.
      - Then: Internal Testing, Create a Release
    - To release: repeatedly check the "Production" track and the release details/track until it allows you to release to production. (Sometimes it doesn't show for a few minutes. Maybe login/logout would help.)

- ios
  - In ios/EndorserMobile/Info.plist, update CFBundleShortVersionString to match version in package.json, and CFBundleVersion to be the build number (same as in Android).
  - In ios/EndorserMobile.xcodeproj/project.pbxproj, make the two instances of CURRENT_PROJECT_VERSION to be the build number (same as CFBundle Version. same as in android).
    - Alternatively, you could enable 'increment_build_number' in ios/fastlane/Fastfile.
    - The project.pbxproj doesn't actually do anything when using fastlane.
  - Create a release in App Store Connect
    - Have a test build?  IDK... maybe don't click 'Expire'
    - For a new one: in App Connect -> App Store next to iOS App, click the "+"
    - For an existing one: under "Build" and all the way to the right of the number (which you have to mouse-over to see), click the red icon to remove that version, then add another version.  Also change the "Version" in the field below the icons.

  - Build & upload to App Store Connect
    - If you changed any UI:
      - Screenshot on different simulator: `yarn run ios --simulator='iPhone 8' (also 'iPhone 5.5"')
        6.5" (eg. iPhone 11) taken at 361x780 then scaled to 1284x2778 (exactly)
        5.5" (eg. iPhone 8) ... 361x642 or 400x712 ... 1242x2208 (exactly)
      - Add screenshots to version control in endorser-mobile-assets
    - `cd ios; bundle exec fastlane beta; cd ..`
      - Note that the upload fails if you didn't already create a release in App Store Connect.
    - This takes about 30 minutes. The upload takes about 10 at the end; there's no prompt after requesting the 6-digit code.
    - After entering the 6-digit code (in about 18 minutes), it should say "Login Successful". It failed when I was on a VPN... maybe because I hadn't created the version in the App Store yet.
  - Submit the release for review (by filling in the "What's New" and "Notes"), and after they approve the review then you can test in TestFlight or release.
    - Double-check that it's submitted for review: choose the app, click App Review on the side, choose it from Ready For Review list, and hit "Submit to App Review". (It should say "Waiting for Review". Just clicking "Add to Review" on the first screen isn't enough.)
    - Review for TestFlight is different from the app review, so: make sure to choose the group for testing, click on the version build number, and submit for review. (When you first add the build, it'll say "Waiting for Review", then "Processing" on the group "Builds" section. It'll be ready when the build under "Version" has a green check and says "Testing". "App Store Connect Users" doesn't show the same options or details. "Ready to Submit" means you haven't submitted it for testing so try again.)
      - Test that you've got existing data on a device before upgrading in TestFlight.
  - If you haven't told it to release automatically, be sure to click the button.

- ... and after that upload:
  - update CHANGELOG commit hash.
  - Make sure to commit those changes to git.
  - Bump the version in: package.json

- ... and if it's a final release:
  - Bump the version (eg to "-rc") in: package.json, android/app/build.gradle, ios/EndorserMobile/Info.plist
