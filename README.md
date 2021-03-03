
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

Next Release:

- Push changes to endorser-ch (for lower-case addrs... and uport-demo while you're at it)
- Update version Code & Name in package.json, android/app/build.gradle
- Update CFBundleShortVersionString and CFBundleVersion in ios/PRODUCT/Info.plist
- `fastlane beta`
