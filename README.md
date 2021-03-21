
# Endorser Mobile

## Build & Run

`yarn install`

Run ios:

`cd ios; pod install; cd ..`

`yarn run ios`

(If there's a complaint about Metro, `yarn start` before that.)

Run android:

`yarn run android`

Clean:

`./node_modules/.bin/react-native-clean-project`

To Release:

- In package.json, update version
- In src/utility/utility.ts: check servers, TEST_MODE is false
- ios
  - In ios/EndorserMobile/Info.plist, update CFBundleShortVersionString
  - `cd ios; bundle exec fastlane beta; cd ..`
  - (Note that CFBundleVersion is done by fastlane beta.)
  - Screenshot on different simulator: `yarn run ios --simulator="iPhone 8"`
    6.5" (eg. iPhone 11)
    take at 361x780 then scale to 1284x2778
    5.5" (eg. iPhone 8)
    ... 361x642 or 400x712 ... 1242x2208
  - Add screenshots to version control.
- android
  - In the android folder, put pc-api-7249509642322112640-286-534d849dfda0.json
  - In the android/app folder, put google-comm-endo-upload-key.keystore
  - In android/app/build.gradle, update versionCode & versionName
  - `cd android; bundle exec fastlane beta; cd ..`
  - To create a new release & upload, do one of these in Google Play Console:
    - In Production, "Create new release" (unless it says "Edit release")
    - In "Releases overview" under "Latest releases" click arrow on right of next release.
