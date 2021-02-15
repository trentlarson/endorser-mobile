
# Endorser Mobile

## Build & Run

Start Metro:

`yarn start`

Run ios:

`cd ios; pod install; cd ..`

`yarn run ios`

Clean:

`./node_modules/.bin/react-native-clean-project`

Release:

- Push changes to endorser-ch (for lower-case addrs... and uport-demo while you're at it)

- Update version Code & Name in package.json, android/app/build.gradle
- Update CFBundleShortVersionString and CFBundleVersion in ios/PRODUCT/Info.plist
- `fastlane beta`
