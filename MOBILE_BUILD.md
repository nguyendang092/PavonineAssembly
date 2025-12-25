# PavonineAssembly Mobile Build Guide

This app is configured with **Capacitor** to build native iOS and Android apps from the React/Vite codebase.

## Prerequisites

### For Android Build

- **Java Development Kit (JDK) 17+** ([download](https://www.oracle.com/java/technologies/downloads/))
- **Android SDK** via Android Studio ([download](https://developer.android.com/studio))
  - Set `ANDROID_SDK_ROOT` environment variable to your SDK installation path
  - Example: `C:\Users\YourUser\AppData\Local\Android\Sdk`
- **Node.js & npm** (already installed)

### For iOS Build (macOS only)

- **Xcode** (from App Store)
- **CocoaPods** (`sudo gem install cocoapods`)
- **macOS 13+**

---

## Quick Start: Build Android APK

### 1. Build the web app (if you haven't already)

```bash
npm run build
```

### 2. Copy web files to Android

```bash
npm run cap:copy:android
```

### 3. Open Android Studio and build

```bash
npm run cap:open:android
```

**In Android Studio:**

- Wait for Gradle sync to complete
- Click **Build > Build Bundle(s) / APK(s) > Build APK(s)**
- Find APK in: `android/app/build/outputs/apk/debug/app-debug.apk`

### 4. Install on emulator or device

```bash
# Via command line (requires adb)
adb install android/app/build/outputs/apk/debug/app-debug.apk

# Or drag-drop APK into Android Studio's emulator
```

---

## Quick Start: Build iOS App (macOS)

### 1. Build the web app

```bash
npm run build
```

### 2. Add iOS platform (first time only)

```bash
npm run cap:add:ios
```

### 3. Copy web files to iOS

```bash
npm run cap:copy:ios
```

### 4. Open Xcode and build

```bash
npm run cap:open:ios
```

**In Xcode:**

- Select simulator or connected device at top
- Click **Product > Build** (⌘B)
- Click **Product > Run** (⌘R) to launch on simulator

---

## Useful Commands

```bash
# Sync all platforms (run after web changes)
npm run cap:sync

# Copy only to Android
npm run cap:copy:android

# Copy only to iOS
npm run cap:copy:ios

# Open Android project in Android Studio
npm run cap:open:android

# Open iOS project in Xcode
npm run cap:open:ios

# Rebuild web first, then sync all platforms
npm run build && npm run cap:sync
```

---

## Troubleshooting

### "gradle-wrapper.jar not found"

- Delete `android/.gradle` folder
- Run `npm run cap:open:android` again to re-sync

### "Pod install failed" (iOS)

```bash
cd ios/App
rm -rf Pods Podfile.lock
pod install
```

### Android build fails with "ANDROID_SDK_ROOT not set"

1. Download Android SDK via Android Studio
2. Set environment variable:
   - **Windows:** `setx ANDROID_SDK_ROOT "C:\Users\YourUser\AppData\Local\Android\Sdk"`
   - **macOS:** `echo 'export ANDROID_SDK_ROOT=~/Library/Android/sdk' >> ~/.bash_profile`
3. Restart terminal/IDE

### "No signed apk" after build

- Use debug APK from `android/app/build/outputs/apk/debug/app-debug.apk`
- For release APK, requires keystore signing (see [Android docs](https://developer.android.com/studio/publish/app-signing))

---

## Project Structure

```
PavonineAssembly/
├── src/                   # React source code
├── dist/                  # Built web app (output)
├── android/               # Android project
│   ├── app/src/main/java/ # Android Java code
│   ├── build.gradle       # Gradle config
│   └── ...
├── ios/                   # iOS project (after `cap add ios`)
│   ├── App/               # Xcode project
│   ├── Podfile            # CocoaPods config
│   └── ...
├── capacitor.config.json  # Capacitor config
└── package.json          # npm scripts
```

---

## Environment Variables & App Config

Edit `capacitor.config.json` to change:

- `appId`: Package ID (e.g., `com.pavonine.assembly`)
- `appName`: Display name in app stores
- `webDir`: Path to web build (currently `dist`)

---

## CI/CD Integration

To automate builds, use:

- **GitHub Actions** with cibuild workflows
- **Fastlane** for iOS automation
- **Gradle** for Android automation

Contact the team for more details.

---

## Support

For issues:

1. Check [Capacitor docs](https://capacitorjs.com/docs)
2. Review build logs in Android Studio / Xcode
3. Check `capacitor.config.json` and `vite.config.js`
