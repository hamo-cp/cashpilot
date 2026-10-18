# CashPilot Android Capacitor Packaging & Verification Guide

## 1. Architecture & Configuration Summary

- **Application ID**: `com.cashpilot.app`
- **Application Name**: `CashPilot`
- **Web Asset Staging Directory**: `www/` (populated deterministically via `npm run build:web` / `scripts/build-web.mjs`)
- **WebView Origin**: `https://localhost` (`server.androidScheme: "https"`, default `hostname: "localhost"`)
- **Pinned Capacitor Packages**:
  - `@capacitor/core`: `7.6.9`
  - `@capacitor/android`: `7.6.9`
  - `@capacitor/cli`: `7.6.9`

> **Origin & Upgrade Stability Rule**: Do not change `appId` (`com.cashpilot.app`), `server.androidScheme` (`https`), or `server.hostname` (`localhost`) without a data migration plan. Android WebView partitions `localStorage` by origin inside `/data/data/com.cashpilot.app/app_webview/Default/Local Storage/leveldb/`. Keeping these values fixed preserves all user records across normal APK updates.

---

## 2. Android SDK Version Policy

`compileSdkVersion`, `targetSdkVersion`, and the **Android 14 (API 34) runtime test target** serve distinct purposes:

| Setting | Configured Value | Rationale |
| :--- | :--- | :--- |
| `minSdkVersion` | `23` (Android 6.0) | Minimum OS supported by Capacitor 7.6.9. |
| `compileSdkVersion` | `35` (Android 15) | Required by Capacitor 7.6.9 and its AndroidX dependencies (`androidx.core:1.15.0`, `androidx.appcompat:1.7.0`, `androidx.webkit:1.12.1`). Downgrading `compileSdkVersion` to 34 would fail AndroidX symbol/resource resolution during compilation. |
| `targetSdkVersion` | `35` (Android 15) | Aligns with Capacitor 7.6.9 platform behavior and Android 12+ data extraction enforcement. |
| **Runtime Test Target** | **Android 14 (API 34)** | Target OS version for device/emulator runtime validation (fully supported since `minSdkVersion (23) <= 34 <= targetSdkVersion (35)`). |

---

## 3. Privacy, Backup & Data Extraction Configuration

CashPilot stores personal financial records locally in WebView `localStorage` (`mz_income`, `mz_expenses`, `mz_debts`, `mz_investments`, `mz_subscriptions`, `mz_budget`, `mz_settings`). To prevent unintended cloud uploads or silent restoration of stale data on fresh installs:

1. **Manifest Flags** (`android/app/src/main/AndroidManifest.xml`):
   - `android:allowBackup="false"`
   - `android:fullBackupOnly="false"`
   - `android:fullBackupContent="@xml/backup_rules"`
   - `android:dataExtractionRules="@xml/data_extraction_rules"`
   - `tools:replace="android:allowBackup"` (prevents transitive library manifests from overriding `allowBackup` during manifest merging)
2. **Android 6–11 Auto Backup Rules** (`android/app/src/main/res/xml/backup_rules.xml`):
   - Excludes `root`, `file`, `database`, `sharedpref`, and `external` domains.
3. **Android 12+ Data Extraction Rules** (`android/app/src/main/res/xml/data_extraction_rules.xml`):
   - Excludes `root`, `file`, `database`, `sharedpref`, and `external` domains across both `<cloud-backup>` and `<device-transfer>`.
4. **Platform Caveats**:
   - On rooted devices or debuggable builds (`app-debug.apk`), users with USB debugging (`adb`) enabled can inspect app data via `run-as com.cashpilot.app`.
   - User-initiated backups use explicit JSON export/import (`src/services/backup.js`) through Android's Storage Access Framework (`Intent.ACTION_CREATE_DOCUMENT` / `DocumentsUI`).

---

## 4. Native WebView Runtime Adaptations

1. **Service Worker Bypass on Native Capacitor** (`src/core/utils.js`, `src/main.js`):
   - `registerAppServiceWorker()` skips registering `./service-worker.js` (and unregisters any prior registration) when `isNativeCapacitor()` is `true`. This prevents cache-first Service Worker entries from serving stale JS/HTML after an APK upgrade, while keeping full offline PWA Service Worker registration on web browsers.
2. **PWA Install Control Suppression** (`src/ui/install.js`):
   - `bindPWAInstall()` treats native Capacitor as standalone so `#installBtn` never renders inside the Android app.
3. **JSON Backup Export & Import** (`src/services/backup.js`, `index.html`, `MainActivity.java`):
   - Export uses `window.CashPilotAndroid.saveJsonBackup(filename, json)` on Android (launching Android's permissionless `ACTION_CREATE_DOCUMENT` system file saver), falls back to Web Share API (`navigator.share`), and preserves `<a download>` on web browsers.
   - Import (`#importFile`) declares `accept=".json,application/json,text/plain"` for compatibility with Android 14 `DocumentsUI` MIME filters.
4. **Hardware Back Navigation** (`src/ui/nav.js`, `src/main.js`, `MainActivity.java`):
   - Pressing Back on Android invokes `window.App.handleAndroidBack()`, which dismisses an active confirm dialog first, then an active modal overlay, then navigates non-dashboard pages back to `dashboard`, and only exits the Activity when already on `dashboard`.
5. **Print & Notifications**:
   - `printSummary()` delegates to `window.CashPilotAndroid.printHtml(title, html)` on Android (invoking `android.print.PrintManager`) and `window.open('', '_blank')` on web browsers.
   - Android `WebView` does not implement the Web `Notification` API; CashPilot falls back to its persistent in-app notification center (`mz_notifications` in `localStorage`) without error. Native OS tray notifications would require adding a native notification plugin and `POST_NOTIFICATIONS` permission in a future phase if desired.

---

## 5. Build & Validation Commands

```bash
# 1. Stage approved runtime web assets into www/
npm run build:web

# 2. Synchronize staged web assets into the Android project
npm run cap:sync

# 3. Run unit, integration, configuration, and security test suites
npm test
npm run test:security

# 4. Build debug APK (in CI or locally with JDK 21 + Android SDK 35)
cd android && ./gradlew assembleDebug
```

---

## 6. Automated Checks vs. Android 14 Device / Emulator Checklist

### Automatically Verified in Node / CI
- Deterministic `www/` staging allowlist and exclusion of repo docs/tests/configs (`tests/android-capacitor.test.mjs`).
- Capacitor `appId`, `webDir`, `https` scheme, pinned `7.6.9` package versions, and SDK bounds (`tests/android-capacitor.test.mjs`).
- Android manifest & XML backup/data-extraction exclusion rules and merged manifest verification (`tests/android-capacitor.test.mjs` & `.github/workflows/android-debug.yml`).
- Native vs. web Service Worker registration, PWA install suppression, backup export strategy selection, hardware back priority order, and print bridge delegation (`tests/android-capacitor.test.mjs`).
- Full regression, security, and Chromium CDP browser suites (`npm test`, `npm run test:security`, `npm run test:browser`).
- Gradle `assembleDebug` compilation and non-empty `app-debug.apk` artifact upload (`.github/workflows/android-debug.yml`).

### Requires Android 14 (API 34) Emulator or Physical Device
- [ ] **Cold start & empty initial state**: Install `app-debug.apk` on a clean Android 14 (API 34) target and verify empty initial state (0 records, no console/WebView errors).
- [ ] **RTL/LTR & Theme switching**: Toggle Arabic (`rtl`) / English (`ltr`) and Dark / Light themes from the More page; verify layout and bottom navigation inset rendering.
- [ ] **CRUD across all 7 modules**: Create, edit, and delete records in Income, Expenses, Debts, Investments, Subscriptions, and Budget; verify settings persistence.
- [ ] **Process death & upgrade persistence**: Force-stop and relaunch the app (and install an updated debug APK over the existing install via `adb install -r app-debug.apk`); verify all `localStorage` data persists.
- [ ] **End-to-end SAF JSON Backup Export & Import**: Export a JSON backup via the Android 14 `DocumentsUI` Save dialog, clear or modify records, and restore the saved JSON file via Import.
- [ ] **Offline Airplane Mode & Market Fallback**: Enable Airplane Mode, cold-start the app, verify offline banner and cached/fallback market rates on the Investments page.
- [ ] **Hardware Back Gesture**: Verify Android 14 back gesture closes confirm dialogs first, then modals, then returns to `dashboard`, and exits from `dashboard`.
- [ ] **Android Print Spooler UI**: Tap Print Summary on the More page and verify the Android system Print / Save-as-PDF preview renders properly.
