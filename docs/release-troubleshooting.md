# SynCatch Release & Build Troubleshooting

Reference for issues that come up when producing signed release builds (Android APK, desktop installers) and running the CI release pipeline, with their fixes.

> **Note on identifiers:** SynCatch's Tauri bundle identifier is still `com.missioncontrol.desktop` and the desktop product folder is `MissionControl`. On-disk paths below are correct as written.

---

## 1. Android APK Build Issues

### 1.1 Keystore path resolution (Gradle)
**Symptom:**
```
Keystore file '.../app/src-tauri/gen/android/android-***-keystore.jks' not found
```

**Cause:** `storeFile` in `keystore.properties` resolved relative to the `app/` build dir instead of the root Android project, duplicating the path.

**Fix:** In `src-tauri/gen/android/app/build.gradle.kts`, use `rootProject.file()`:
```kotlin
// Wrong — relative to app/
storeFile = file(keystoreProperties.getProperty("storeFile"))
// Correct — relative to root project
storeFile = rootProject.file(keystoreProperties.getProperty("storeFile"))
```
Keep the filename simple in `.github/workflows/release.yml`:
```yaml
storeFile=android-upload-keystore.jks
```

### 1.2 Keystore password mismatch
**Symptom:** `KeytoolException: ... keystore password was incorrect`

**Cause:** GitHub secret `ANDROID_KEY_PASSWORD` doesn't match the password baked into `ANDROID_KEY_BASE64`.

**Fix:** In GitHub → Settings → Secrets and variables → Actions, align:
- `ANDROID_KEY_BASE64` — base64-encoded keystore file
- `ANDROID_KEY_PASSWORD` — that keystore's actual password
- `ANDROID_KEY_ALIAS` — the key alias

Generate a local test keystore:
```bash
keytool -genkey -v -keystore ~/.config/missioncontrol/android-upload-keystore.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias upload -storepass testpass123 -keypass testpass123 \
  -dname "CN=SynCatch,O=Test,L=Test,S=Test,C=US"
```

### 1.3 Local keystore corruption
**Symptom:** `java.io.IOException: keystore password was incorrect`

**Fix:** Delete and recreate:
```bash
rm -f ~/.config/missioncontrol/android-upload-keystore.jks
# regenerate with the keytool command above
```

### 1.4 Java source/target deprecation
**Symptom:** `Java compiler version 21 has deprecated support for compiling with source/target version 8`

**Fix:** In `src-tauri/gen/android/gradle.properties`:
```properties
android.javaCompile.suppressSourceTargetDeprecationWarning=true
```
Or raise `jvmTarget` in `build.gradle.kts`:
```kotlin
kotlinOptions { jvmTarget = "11" }  // or higher
```

---

## 2. CI/CD Pipeline Issues

### 2.1 Unstable GitHub Actions versions
Pin known-good versions instead of chasing the newest:
```yaml
- uses: actions/checkout@v4
- uses: actions/setup-node@v5
- uses: actions/setup-java@v4
- uses: swatinem/rust-cache@v2
- uses: actions/upload-artifact@v4
```

### 2.2 NDK version mismatch
Pin the NDK and document compatibility in `.github/workflows/release.yml`:
```yaml
- name: Setup Android NDK
  if: matrix.name == 'android-apk'
  run: |
    # NDK 26.1.10909125 — verified with Tauri 2.x and Android Gradle plugin 8.x
    echo "ANDROID_NDK_HOME=${ANDROID_SDK_ROOT}/ndk/26.1.10909125" >> $GITHUB_ENV
```

### 2.3 Required GitHub secrets
Builds fail silently when these are missing:
- `ANDROID_KEY_BASE64`, `ANDROID_KEY_PASSWORD`, `ANDROID_KEY_ALIAS`
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

Verify the base64 keystore decodes to a binary file:
```bash
echo "$ANDROID_KEY_BASE64_VALUE" | base64 -d | file -   # expect: data
```

---

## 3. Desktop App Issues

### 3.1 HUD window not showing / app unresponsive after login
**Likely causes:** silent HUD-window creation failure, corrupted app cache, or DB init failure.

**Fix:**
1. **Clear cache** (Windows): delete `%APPDATA%\MissionControl` and `%LOCALAPPDATA%\MissionControl`.
2. **Reinstall fresh**: uninstall, delete the cache folders above, reinstall.
3. **Check logs**: look in `%LOCALAPPDATA%\MissionControl`; press F12 in-app for the web console.

### 3.2 App won't reopen after closing
Usually a database lock or corrupted state file — clear `%APPDATA%\MissionControl` as in 3.1.

---

## 4. Release Process

### 4.1 Re-tagging after late changes
```bash
git tag -d v0.x.x                       # delete local
git push origin --delete v0.x.x         # delete remote
git tag -a v0.x.x -m "Release message"  # recreate
git push origin v0.x.x                  # push
```

### 4.2 Monitoring CI
```bash
gh run list --workflow=release.yml --limit=5
gh run view <run_id>
```
Or watch: https://github.com/deepakraaaj/SynCatch/actions

---

## 5. Build Commands

```bash
npm run android:build:release   # local Android release APK
npm run tauri:build             # local desktop installers
```

Trigger a CI release by pushing a tag:
```bash
git tag -a v0.x.x -m "Release message" && git push origin v0.x.x
```

---

## 6. Pre-Release Checklist

- [ ] GitHub secrets valid and current
- [ ] Local Android build passes with keystore
- [ ] Action versions pinned in the workflow
- [ ] Desktop app builds locally; login + HUD verified on Windows
- [ ] Database initialization checked
- [ ] All platform artifacts verified before publishing

See also: [Android Release](android-release.md) · [Developer Guide](developer-guide.md)
