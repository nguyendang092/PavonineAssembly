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

## Deploy to Google Play Store

### Bước 1: Tạo Keystore (Chỉ làm 1 lần)

**QUAN TRỌNG:** Lưu keystore file và password cẩn thận. Nếu mất keystore, bạn không thể update app trên Google Play!

```bash
# Tạo keystore (thay YOUR_NAME bằng tên của bạn)
keytool -genkey -v -keystore pavonine-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias pavonine-assembly

# Keystore sẽ được tạo tại: pavonine-release-key.jks
# Lưu file này ở nơi AN TOÀN (không commit lên git!)
```

Khi chạy lệnh trên, bạn sẽ được hỏi:

- **Keystore password:** Nhập password (VD: `MyStrongPass123!`) - GHI NHỚ PASSWORD NÀY!
- **Key password:** Nhập password (có thể giống keystore password)
- **Name, Organization, etc:** Nhập thông tin công ty/cá nhân

### Bước 2: Cấu hình Gradle để ký APK

**2.1. Tạo file `android/key.properties`** (không commit file này):

```properties
storePassword=YOUR_KEYSTORE_PASSWORD
keyPassword=YOUR_KEY_PASSWORD
keyAlias=pavonine-assembly
storeFile=../pavonine-release-key.jks
```

**2.2. Sửa file `android/app/build.gradle`:**

Thêm vào **TRƯỚC** `android {`:

```gradle
def keystorePropertiesFile = rootProject.file("key.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}
```

Thêm vào **TRONG** `android { ... }`, sau `buildTypes {`:

```gradle
    signingConfigs {
        release {
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
            storeFile keystoreProperties['storeFile'] ? file(keystoreProperties['storeFile']) : null
            storePassword keystoreProperties['storePassword']
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
```

### Bước 3: Build Release APK/AAB

```bash
# 1. Build web app
npm run build

# 2. Copy to Android
npm run cap:copy:android

# 3. Mở Android Studio
npm run cap:open:android
```

**Trong Android Studio:**

**Cách 1: Build AAB (Google Play yêu cầu - KHUYẾN NGHỊ):**

1. Click **Build > Generate Signed Bundle / APK**
2. Chọn **Android App Bundle** → Next
3. Chọn keystore file (`pavonine-release-key.jks`)
4. Nhập passwords
5. Chọn **release** build variant
6. Click **Finish**
7. File AAB sẽ ở: `android/app/release/app-release.aab`

**Cách 2: Build APK (để test trước khi lên store):**

1. Click **Build > Generate Signed Bundle / APK**
2. Chọn **APK** → Next
3. Làm tương tự như AAB
4. File APK sẽ ở: `android/app/release/app-release.apk`

### Bước 4: Đăng ký Google Play Console

1. Truy cập [Google Play Console](https://play.google.com/console)
2. Trả phí $25 (1 lần duy nhất) để tạo tài khoản Developer
3. Chờ xác minh tài khoản (~1-2 ngày)

### Bước 5: Tạo App mới trên Google Play Console

1. Click **Create app**
2. Điền thông tin:
   - **App name:** PavonineAssembly
   - **Default language:** Tiếng Việt
   - **App or game:** App
   - **Free or paid:** Free
3. Đồng ý điều khoản → **Create app**

### Bước 6: Chuẩn bị thông tin App (Store Listing)

Trong **Store presence > Main store listing**, điền:

- **App name:** PavonineAssembly
- **Short description:** (50 ký tự) - Mô tả ngắn gọn
- **Full description:** (4000 ký tự) - Mô tả chi tiết tính năng
- **App icon:** 512x512 PNG (không trong suốt)
- **Feature graphic:** 1024x500 PNG
- **Screenshots:** Ít nhất 2 ảnh (phone: 320-3840px)
- **Category:** Business / Productivity
- **Email:** Email liên hệ support

### Bước 7: Thiết lập nội dung (Content rating)

1. Vào **Policy > App content**
2. Điền **Content rating questionnaire**
3. Chọn đúng category (Business app)
4. Submit và nhận rating

### Bước 8: Upload AAB lên Google Play

1. Vào **Release > Production** (hoặc Internal testing để test trước)
2. Click **Create new release**
3. Upload file `app-release.aab`
4. Điền **Release name:** v1.0.0
5. Điền **Release notes** (What's new):
   ```
   Phiên bản đầu tiên:
   - Quản lý điểm danh
   - Quản lý sản xuất
   - Quản lý kho hàng
   - Quản lý logistics
   ```
6. Click **Save** → **Review release**
7. Click **Start rollout to Production**

### Bước 9: Chờ Google duyệt

- Thời gian review: 1-7 ngày
- Google sẽ email thông báo kết quả
- Nếu bị từ chối, sửa theo yêu cầu và submit lại

### Bước 10: Update phiên bản sau này

Khi có update:

1. Sửa `version` và `versionCode` trong `android/app/build.gradle`:

   ```gradle
   android {
       defaultConfig {
           versionCode 2        // Tăng lên mỗi lần release
           versionName "1.0.1"  // Version hiển thị cho user
       }
   }
   ```

2. Build lại web và AAB:

   ```bash
   npm run build
   npm run cap:copy:android
   # Mở Android Studio và build AAB mới
   ```

3. Upload AAB mới lên Google Play Console
4. Điền release notes
5. Submit review

---

## Checklist trước khi lên Google Play

- [ ] App icon 512x512 PNG
- [ ] Feature graphic 1024x500 PNG
- [ ] Screenshots (ít nhất 2 ảnh)
- [ ] Privacy Policy URL (nếu app thu thập dữ liệu)
- [ ] Đã test APK release trên thiết bị thật
- [ ] Đã điền đầy đủ Store Listing
- [ ] Đã hoàn thành Content Rating
- [ ] Keystore file được backup an toàn
- [ ] `versionCode` và `versionName` đúng
- [ ] AAB file đã được ký (signed)

---

## Lưu ý quan trọng

⚠️ **KHÔNG BAO GIỜ:**

- Commit keystore file hoặc `key.properties` lên Git
- Chia sẻ keystore password
- Xóa keystore file (backup nhiều nơi!)

✅ **NÊN:**

- Test kỹ APK release trước khi lên store
- Sử dụng Internal Testing track trước Production
- Đọc kỹ chính sách Google Play
- Chuẩn bị Privacy Policy nếu app thu thập dữ liệu người dùng

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
4. Google Play Console help: [developer.android.com](https://developer.android.com/distribute/console)
