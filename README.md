
# Endorser Mobile

A mobile app for recording claims and reporting on them

For the reporting facility, we use the [endorser-ch APIs](https://github.com/trentlarson/endorser-ch).
See next plans in the 'mobile' tasks inside its [project task list](https://raw.githubusercontent.com/trentlarson/endorser-ch/master/project.task.yaml).



## Dependencies

- One way is with asdf-vm.com (which is the only way I can get the deploy to work):

```
asdf plugin add java
asdf install java
asdf plugin add nodejs
asdf install nodejs
asdf plugin add ruby
asdf install ruby
asdf plugin add yarn
asdf install yarn
```

- The following is for tea.xyz, which works for me for development until I try to deploy (eg. `bundle exec fastlane beta` because "mkmf.rb can't find header files for ruby")

| Project       | Version          |
|---------------|------------------|
| cocoapods.org | ^1.15.2          |
| nodejs.org    | >=16.18.0<20.0.0 |
| openjdk.org   | ^20              |
| ruby-lang.org | ^3.2.2           |
| rubygems.org  | ^3.2.34          |
| watchman      | ^2021.08.26      |
| yarnpkg.com   | ^3.4.1           |

... which is equivalent to: `pkgx "+nodejs.org>=16.18.0<20.0.0" +ruby-lang.org^3.2.2 +rubygems.org=3.2.34 +yarnpkg.com^3.4.1 +openjdk.org^20 +cocoapods.org +watchman sh`

We highly recommend pkgx.dev -- and you can use it even if it's not installed by replacing `pkgx` with `sh <(curl https://pkgx.sh)`

## Dev Build & Run

```
yarn install
```

  - Note that there are also some other mobile dependencies, eg. Xcode, iOS CocoaPods, and Android Studio. The tools will prompt you along the way.

- There are some values to customize in src/veramo/setup.ts: SERVICE_ID, INFURA_PROJECT_ID

- For ios:

  - `cd ios; pod install; cd ..`

Run ios:

`yarn run ios`

(If there's a complaint about Metro, `yarn start` before that, maybe with the `--reset-cache` flag.)

Run android:

- `yarn run android`

(If it cannot find emulators, see Troubleshooting below.)

Clean:

`yarn run clean`

... but note that answering "Y" to install pods sometimes doesn't actually install pods (?!) and you may have to `pod install` that by hand.




#### Troubleshoot:

- "Can't find variable: atob" or "Property 'atob' doesn't exist": paste into base64/lib/browser-base64.js the solution from [here](https://github.com/ethers-io/ethers.js/issues/3460#issuecomment-1288202217).

```
var Buffer = require('buffer/').Buffer;
function atob(str) {
  return Buffer.from(str, 'base64').toString('binary');
}
function btoa(str) {
  return Buffer.from(str, 'binary').toString('base64');
}
```


- A "CompileC" error can happen after removing a dependency. You may have to manually remove node_modules and pods (both `ios/Pods` and `~/Library/Caches/CocoaPods`) and reinstall them... but even that may not work and sometimes I just clone a new copy and install anew. (I've also seen it work to just rerun the app.)


```
watchman watch-del-all
rm -rf /tmp/metro-*
rm -rf ~/Library/Caches/CocoaPods ios/Pods
cd ios; pod install; cd ..
rm -rf node_modules
yarn
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

- Got "Notifications permission pod is missing"? Try this: `rm -rf ~/Library/Developer/Xcode/DerivedData`

- Got "The emulator process for avd ... was killed"? Try this (in ~/Library/Android/sdk/emulator or %HOME%\AppData\Local\Android\Sdk\emulator): `./emulator -list-avds` and then `./emulator -avd Pixel_XL_API_30` (or whatever AVD you have)

- Got "No emulators found as an output of `emulator -list-avds`"? Follow previous step.

- Got "CMake '???' found in PATH did not match requested version '3.6.0'."? Install cmake in Android Studio -> Preferences -> Appearance & Behavior -> System Settings -> Android SDK -> SDK Tools. Any 3.6 version should do, though when I did this more recently I had to install 3.10.2

- Got "SDK location not found. Define location with an ANDROID_SDK_ROOT environment variable or by setting the sdk.dir path in your project's local properties file at '???/android/local.properties'."? Put the line "sdk.dir=" with that ANDROID_SDK_ROOT setting, eg. /Users/trent/Library/Android/sdk (because just setting the environment variable doesn't always work).

- Got "InstallException: Unknown failure: cmd: Can't find service: package"? Try running the command again (in case the emulator wasn't fully started).

- Got "The operation couldn’t be completed. (BGTaskSchedulerErrorDomain error 1.)"? If you're running in a simulator, that's expected. (The Simulator on iOS cannot run the background tasks.)

- Got "Unable to deserialize cloned data due to invalid or unsupported version."? Delete .yarn & .yarnrc.yml files.

- Got "No toolchains found in the NDK toolchains folder for ABI with prefix: arm-linux-androideabi"? Go to Android Studio -> Preferences -> Appearance & Behavior -> System Settings -> Android SDK -> SDK Tools and downgrade NDK (v 22 worked while v 23 broke).

- Got "More than one file was found with OS independent path 'lib/armeabi-v7a/libsodium.so'."? Hack the node_modules/react-native-sodium/android/build.gradle and paste in the 'android' section as shown [here](https://stackoverflow.com/a/56453718).

```
packagingOptions {
    pickFirst 'lib/armeabi-v7a/libsodium.so'
    pickFirst 'lib/arm64-v8a/libsodium.so'
    pickFirst 'lib/x86/libsodium.so'
    pickFirst 'lib/x86_64/libsodium.so'
}
```

- Got a blank screen when running on a physical app connected by USB? Try restarting the app on the device. Also, ensure Metro is running on the same network, and the developer tools (opened with `adb shell input keyevent 82`) have Settings with debug server host & port set to the right IP & port (usually 8081).

- The following means the Simulator is in a "Shutdown" state even though the Simulator is running:

```
error Failed to launch the app on simulator, An error was encountered processing the command (domain=com.apple.CoreSimulator.SimError, code=405):
Unable to lookup in current state: Shutdown
```

  Switch to the Simulator app, choose "File" and "Open Simulator" and choose one to run.

- Sometimes the emulator loses external network access. Try a Cold Boot Now (usually via Android Studio).

- During the upload to Apple, you may get errors like "could not find the service with interface (com.apple.transporter.osgi.TransporterService)" or "resource download failed: com.fasterxml.jackson.core.jackson-core". They indicate some network error so just try again.

- During "bundle exec fastlane beta", you might see a message of "Could not find fastlane-2.210.1, CFPropertyList-3.0.5... in any of the sources". Try "bundle install".

- Builds may get: "In .../node_modules/react-native-sodium/libsodium/libsodium-ios/lib/libsodium.a(libsodium_la-aead_chacha20poly1305.o), building for iOS Simulator, but linking in object file built for iOS, file '.../node_modules/react-native-sodium/libsodium/libsodium-ios/lib/libsodium.a' for architecture arm64" when building on M1. Open a terminal "using Rosetta" and run from there. (You may have to check out a clean set of source files.) (I would sure like to find a way to run natively!)

- Compilation may complain about "node->getLayout().hadOverflow() |" in Yoga.cpp on Xcode 14.3. Edit node_modules/react-native/ReactCommon/yoga/yoga/Yoga.cpp and change the line to make it double: "||" (Only necessary on line 2285.)

- Got "Error: ENOENT: no such file or directory, lstat 'node_modules'"? That's weird because we fixed this with the .yarnrc.yml file. See https://chatgpt.com/share/620491ee-31e7-4a04-8750-0f2746a448d2





## Create a New DB Migration

`yarn dlx typeorm migration:create src/migration/ProjectBookmarks`

... and edit it to include a field: 'public name = "ClassName...789"'
... and edit src/veramo/setup.js and add import for that file and add to `migrations` (and add to ALL_ENTITIES if there's a new table)
... and edit the src/entity entry if you modified an existing table



## Test

Automatically with: `yarn test`

... but note:

- The App-test.js fails with "NativeModule.RNPermissions is null" or "Notifee
  native module not found". I've tried but failed with the recommendation here:
  https://github.com/zoontek/react-native-permissions#testing-with-jest

Manually

- Without an Endorser.ch server

  - Create IDs, export, and import.
  - Create contacts.

- With an Endorser.ch server

  - Start with no app installed. Change PeriodicWorkRequest time increment in
    MainApplication.java to 1 MINUTES (then back to DAYS when finished testing).

  - On a public test server
    - Run in Test Mode (under Settings & Advanced Mode) and click the button to
      choose the test server.
  - On your machine
    - Run endorser-ch test/test.sh, then copy the endorser-ch-test-local.sqlite3
      to endorser-ch-dev.sqlite3, then run the server.

  - Create an identifier.

    - You can import a test user from [here](https://github.com/trentlarson/endorser-ch/blob/master/test/util.js#L73). If paste doesn't work, here are some command-line import for Android:

      - for User #0: `adb shell input text "rigid\ shrug\ mobile\ smart\ veteran\ half\ all\ pond\ toilet\ brave\ review\ universe\ ship\ congress\ found\ yard\ skate\ elite\ apology\ jar\ uniform\ subway\ slender\ luggage"`

        - This user has large registration and claim limits.

      - for User #2: `adb shell input text "wild\ trade\ rescue\ help\ access\ cave\ expand\ toward\ coconut\ gas\ weird\ neck\ history\ wealth\ desk\ course\ action\ number\ print\ ahead\ black\ song\ dumb\ long"`

        - This user has a large number of items in their friend feed.

  - Add your name.

  - After a claim:

    - On Notification screen, run the daily background check.
    - Close app (android) or background app (iOS) & see notification of new
      claims after 15 minutes. (On android, that's the minimum time to start a
      background task.)

  - As a second user, import via the mnemonic, eg. #3 from endorser-ch test/util.js

  - Submit a claim. Run search for this individual's claims, and then for all claims.
  - As a second, third, & fourth user, check that they cannot see the claim details.
  - As a second, third, & fourth user, check that they can see claim presentation from first.

  - As the second and third user, share contact info.
  - As the initial user, allow the second and third user to see them.
  - As the second user, check that they can see the claim details.
  - As the fourth user, check that they can access people in their network who
    can get to the claim.

  - As the third user, check that they can confirm the first claim.
  - As the fourth user, check that they can see people in their network who can
    get to the confirmation info.

  - As the third user, check that they cannot see the claim details but can see a link.
  - As the second user, submit confirmation.

  - Create an Offer, show total outstanding, mark as given, see adjustment of totals.

  - Test visibility of targeted feed (on front page). One way is with test data
    with almost any user who can see the Gives/Offers/Plans for User #2.

- On an actual device (remember the table-name fiasco!)

  - Look at the existing identity & export, feed, and contacts,
    then double-check afterward that they didn't change.

  - Android
    - Must use Play Store to release to internal testing (because migrations
      fiasco wasn't caught when connected directly to the device).
    - To work with different versions, increment versionCode in different clones
      of the repo (built from scratch), and test in Internal Testing with
      alternating builds & uploads.

  - iOS
    - TestFlight is recommended (though potentially OK to use Xcode, since it
      would have caught the migrations fiasco).

  - Install then create or import.

  - Notification permissions: new install messaging, accepted, declined then
    accepted, turned off in settings then accepted, ensure user knows when off.




## Package & Deploy

To configure first release on new environment:

- Android
  - In the android/app folder, put pc-api-....json and google-comm-endo-upload-key.keystore
- iOS
  - In the ios directory, run `bundle update`
  - In Xcode, add the developer account under Preferences -> Accounts. (Maybe import the project.)
  - Configure Apple signing. (Certain errors will prompt you for this stuff, eg. '')
    - To renew certificate: https://developer.apple.com/account/resources/certificates/list
      ... and make one for Apple Distribution
      ... and also Apple Development (not sure about iOS App Development or iOS App Distribution)
      ... and add a new Provisioning Profile - for Development (and maybe iOS App Development), selecting the Dev cert
      ... and go to Pods -> Build Settings -> Signing
        - Code Signing Identity -> Release -> set to Apple Development
        - Development Team set to Trent Larson
      ... and possibly restart Xcode. (Yes, that make it work after these errors: "Provisioning profile... doesn't include signing certificate")
    - The React-Core-AccessibilityResources signing is an independent setting.
      (Example error: "Signing for "React-Core-AccessibilityResources" requires a development team. Select a development team in the Signing & Capabilities editor.")
      In Xcode, with Pods at the same level as EndorserMobile on the left,
      right-click and "Open as Xcode Project" and then select React-Core-AccessibilityResources
      and select the development team.
    - I've had to type in my password in a pop-up dozens of times.
    - The file `.env.default` in `ios` will allow you to upload to Apple:
```
FASTLANE_USER=<Apple USER ID>
FASTLANE_PASSWORD=<Apple Password>
FASTLANE_APPLE_APPLICATION_SPECIFIC_PASSWORD=<App-Specific Password>
```
    - If 2FA is a problem, try https://github.com/fastlane/fastlane/blob/master/spaceship/docs/Authentication.md#auto-select-sms-via-spaceship_2fa_sms_default_phone_number (though this didn't work for me)


To Release:
- For minimal Contract app, change configuration
  - In src/veramo/setup.ts, switch HANDY_APP to true
- Test everything.
  - To install on a local iPhone, you can edit the scheme in the product to have a build configuration of "Release".
- Update CHANGELOG.md
- Set INFURA_PROJECT_ID in src/veramo/setup.ts (useful for checking claims)
- In package.json, update version
- Change the version info for android & ios below (so the tag has the new values)
- Tag
- (I recommend starting with ios since it takes longer to get approved.)
- android
  - In android/app/build.gradle, update versionName (to match version in package.json) & versionCode (with build number to match ios)
    - Always increment the versionCode (and ensure you don't already have a larger release in ios, just for consistency's sake).  It is possible to reuse the versionName.
  - `cd android; bundle exec fastlane beta; cd ..`
    - It will prompt for credentials immediately.
    - For error: "Keystore file 'endorser-mobile/android/fastlane/../app/google...keystore' not found for signing config 'externalOverride'."
      - Put the google...keystore file in place.
    - For error: "Google Api Error: forbidden: The caller does not have permission"
      - Check that the pc-api...json file is in place. Also go to Console -> Setup -> API access and find that Service Account key, then Grant Access.
  - To create a new release & upload -- especially if it shows on Releases Overview but not in Production track:
    - In Google Play Console, under Production, "Create new release", add the bundle, and "Next"/"Save" a couple times.
    - After uploading, "Save", "Review Release", then "Rollout to internal testing".
    - Test
      - First check the old version with existing data on a device.
      - Then: Internal Testing, Create a Release
    - To release: Go to Internal Testing, then View Release Details, then "Promote release" and select "Production", add details and "Save", then "Start rollout to Production". It'll show as "In review" for a little while. (Old instructions: repeatedly check the "Production" track and the release details/track until it allows you to release to production; sometimes it doesn't show for a few minutes; maybe login/logout would help.)
      - One time I went to "Publishing Overview" on the side and it showed a button that worked.
    - Note that public testers may have to receive a link and/or turn on auto-update but they will be prompted to update. (They can go back to the public version by uninstalling and going back to the Play Store listing.)

- ios
  - In ios/EndorserMobile/Info.plist, update CFBundleShortVersionString to match version in package.json, and CFBundleVersion to be the build number (same as in Android).
    - Note that you cannot repeat an upload of a build number. (Version is OK.)
  - Change scheme to have a buildConfiguration of "Release" in ios/EndorserMobile.xcodeproj/xcshareddata/xcschemes/EndorserMobile.xcscheme
  - In ios/EndorserMobile.xcodeproj/project.pbxproj, make the two instances of CURRENT_PROJECT_VERSION to be the build number (same as CFBundle Version. same as in android).
    - Alternatively, you could enable 'increment_build_number' in ios/fastlane/Fastfile.
    - The project.pbxproj doesn't actually do anything when using fastlane.
  - Create a release in App Store Connect
    - Have a test build?  IDK... maybe don't click 'Expire'
    - For a new one: in App Connect -> App Store next to iOS App, click the "+"
    - For an existing one: you can rename it, then under "Build" and all the way to the right of the number (which you have to mouse-over to see), click the red icon to remove that version, then add another version.  Also change the "Version" in the field below the icons.

  - Build & upload to App Store Connect
    - If you changed any UI:
      - Screenshot images on different simulator: `yarn run ios --simulator='iPhone 8'` (also 'iPhone 5.5"')
        6.5" (eg. iPhone 11) taken at 361x780 then scaled to 1284x2778 (exactly)
        5.5" (eg. iPhone 8) ... 400x710 ... 1242x2208 (exactly)
      - Add screenshots to version control in endorser-mobile-assets
    - ` export FASTLANE_APPLE_APPLICATION_SPECIFIC_PASSWORD=...App-Specific Password for This Machine...`
    - `cd ios; SPACESHIP_2FA_SMS_DEFAULT_PHONE_NUMBER="+1 (123) 123-1233" FASTLANE_XCODEBUILD_SETTINGS_TIMEOUT=120 bundle exec fastlane beta; cd ..`
      - Note that the upload fails if you didn't already create a release in App Store Connect.
    - This takes about 30 minutes. The upload takes about 10 at the end; there's no prompt after requesting the 6-digit code.
    - After entering the 6-digit code (in about 18 minutes), it should say "Login Successful". It failed when I was on a VPN... maybe because I hadn't created the version in the App Store yet.
  - Submit the release for review (by filling in the "What's New" and "Notes"), and after they approve the review then you can test in TestFlight or release.
    - Double-check that it's submitted for review: it should say "Waiting for Review". (choose the app, click App Review on the side, choose it from Ready For Review list, and hit "Submit to App Review". Just clicking "Add to Review" on the first screen isn't enough.)
    - Review for TestFlight is different from the app review, so: make sure to choose the group for testing, click on the version build number, and submit for review. (When you first add the build, it'll say "Waiting for Review", then "Processing" on the group "Builds" section. It'll have a yellow dot with "Approved" with a link to "Notify Testers" until you click to notify them. It'll be ready when the build under "Version" has a green check and says "Testing". "App Store Connect Users" doesn't show the same options or details. "Ready to Submit" means you haven't submitted it for testing so try again.)
      - Test that you've got existing data on a device before upgrading in TestFlight.
  - If you haven't told it to release automatically, be sure to click the button.

- ... and after that upload:
  - update CHANGELOG commit hash.
  - Make sure to commit those changes to git.
  - Bump the version in: package.json

- ... and if it's a final release:
  - Bump the version (eg to "-rc") in: package.json, android/app/build.gradle, ios/EndorserMobile/Info.plist




## Design

### Interoperability

* Here are some good guidelines for wallet interoperability, which we strive to fulfill: https://mattr.global/resources/articles/wallets-in-the-wild/



### Data: Specifications for Contract Hashes

To create the fieldsMerkle:

- Take all non-blank fields in the contract, in the order they appear in the contract. There should be no whitespace at the beginning or end of any value.

- Construct the merkle tree from those values.

To create the legalMdHash, we follow [Legal Markdown](https://github.com/compleatang/legal-markdown) with some additional restrictions to ensure reproducibility and ease of generation:

- Start the document with: `---` and a newline

- Insert the map of all non-blank key/value pairs. Special characters are in unicode with `\u` prefix, and there is no whitespace at the beginning or the end.

  - Values without newlines are formatted as: `KEY: "VALUE"` (Double quotes are escaped with `\`.)

  - Use `|-` for multiline strings, not surrounded by quotation marks, with 2-space indentation. (Double-quotes need no escaping.)

    - Whitespace is not allowed on the front of the first line. Spaces define the indent level. Newlines can affect the output, but that formatting serves no functional purpose so will be avoided for simplicity.

    - Whitespace in the middle is respected. The 2-space indentation is all that is ignored.

    - Whitespace is not allowed on the end of the last line. There is a final newline in the YAML but it is not part of the value. Spaces are valid in YAML but will be avoided in this spec for simplicity.

- Insert: `---` and a newline

- Insert the contract template.

- [The YAML Multiline page](https://yaml-multiline.info/) is a good summary of multiline behavior, and [the Online YAML Parser](http://www.yaml-online-parser.appspot.com/) is a good place for testing.

Note: the hash algorithm (for legalMdHash and fieldsMerkle) is sha256. (Future implementations may use others, in which case I recommend explicit fields like "legalMdHash512".)

Note: skip empty fields because:

- JSON does not have 'undefined' value and we don't want to explicitly set 'null' values (and most tools unset fields when not explicitly set).

- YAML parsing does strange things with blank content on a map value.

Note: order fields by the order in the contract, by insertion AKA field creation (and not lexicographicslly, for example) because:

- This order is preserved in [many toolsets](https://duckduckgo.com/?q=programming+insertion+order+preservation&t=ffab&ia=web), and it is the standard in recent specifications, eg [SAID](https://www.ietf.org/archive/id/draft-ssmith-said-01.html).

- The ordering in the self-contained Legal Markdown document is more helpful to humans if it's in the order in the contract. For example, parties are usually listed first. Also, the contracts can be structured such that the elements are in a particular desired order.
