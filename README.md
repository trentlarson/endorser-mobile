
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

- Update version in package.json
- ios
  - Update CFBundleShortVersionString and CFBundleVersion in ios/PRODUCT/Info.plist (if that's not done by fastlane beta)
  - `cd ios; bundle exec fastlane beta; cd ..`
- android
  - In the android folder, put pc-api-7249509642322112640-286-534d849dfda0.json
  - In the android/app folder, put google-comm-endo-upload-key.keystore
  - Update versionCode & versionName in android/app/build.gradle
  - `cd android; bundle exec fastlane beta; cd ..`
