# MissionControl Release & Build Troubleshooting Guide

This guide documents all the difficulties encountered during the v0.3.0 release and their solutions.

---

## 1. Android APK Build Issues

### Problem 1.1: Keystore Path Resolution (Gradle)
**Symptom:**
```
Keystore file '/home/runner/work/MissionControl/MissionControl/src-tauri/gen/android/app/src-tauri/gen/android/android-***-keystore.jks' not found
```

**Root Cause:**
The `storeFile` path in `keystore.properties` was being resolved relative to the `app/` build directory instead of the root Android project directory. This caused path duplication.

**Solution:**
In `src-tauri/gen/android/app/build.gradle.kts`, use `rootProject.file()` instead of `file()`:
```kotlin
// Before (WRONG - relative to app/ directory)
storeFile = file(keystoreProperties.getProperty("storeFile"))

// After (CORRECT - relative to root project)
storeFile = rootProject.file(keystoreProperties.getProperty("storeFile"))
```

In `.github/workflows/release.yml`, keep the filename simple:
```yaml
storeFile=android-upload-keystore.jks
```

---

### Problem 1.2: Keystore Password Mismatch
**Symptom:**
```
KeytoolException: Failed to read key upload from store "...": keystore password was incorrect
```

**Root Cause:**
The GitHub secret `ANDROID_KEY_PASSWORD` didn't match the actual password of the keystore encoded in `ANDROID_KEY_BASE64`.

**Solution:**
Update GitHub secrets to match:
1. Go to GitHub repo → Settings → Secrets and variables → Actions
2. Update:
   - `ANDROID_KEY_BASE64`: Base64-encoded keystore file
   - `ANDROID_KEY_PASSWORD`: The actual password for that keystore
   - `ANDROID_KEY_ALIAS`: The alias used in the keystore

To generate a test keystore locally:
```bash
keytool -genkey -v -keystore ~/.config/missioncontrol/android-upload-keystore.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias upload -storepass testpass123 -keypass testpass123 \
  -dname "CN=MissionControl,O=Test,L=Test,S=Test,C=US"
```

---

### Problem 1.3: Local Keystore Corruption
**Symptom:**
```
java.io.IOException: keystore password was incorrect
```

**Root Cause:**
Existing keystore file was corrupted or had wrong password.

**Solution:**
Delete and recreate:
```bash
rm -f ~/.config/missioncontrol/android-upload-keystore.jks
# Then regenerate with keytool command above
```

---

### Problem 1.4: Java 8 Source/Target Deprecation
**Symptom:**
```
Java compiler version 21 has deprecated support for compiling with source/target version 8
```

**Root Cause:**
Android project configured for Java 8 but building with Java 21.

**Solution:**
Add to `src-tauri/gen/android/gradle.properties`:
```properties
android.javaCompile.suppressSourceTargetDeprecationWarning=true
```

Or update `kotlinOptions` in build.gradle.kts:
```kotlin
kotlinOptions {
    jvmTarget = "11"  # or higher
}
```

---

## 2. CI/CD Pipeline Issues

### Problem 2.1: Unstable GitHub Actions Versions
**Symptom:**
- Unpredictable build failures
- Version incompatibilities with runners

**Solution:**
Use stable, well-tested versions:
```yaml
- uses: actions/checkout@v4          # (not v5 - too new)
- uses: actions/setup-node@v5        # (not v6 - too new)
- uses: actions/setup-java@v4        # Stable
- uses: swatinem/rust-cache@v2       # Stable
- uses: upload-artifact@v4           # Stable
```

---

### Problem 2.2: NDK Version Mismatch
**Symptom:**
Build failures when NDK version changes on GitHub runners

**Root Cause:**
NDK version was hardcoded without documentation of compatibility requirements.

**Solution:**
Document in `.github/workflows/release.yml`:
```yaml
- name: Setup Android NDK
  if: matrix.name == 'android-apk'
  run: |
    # NDK 26.1.10909125 - verified compatible with Tauri 2.x and Android Gradle plugin 8.x
    echo "ANDROID_NDK_HOME=${ANDROID_SDK_ROOT}/ndk/26.1.10909125" >> $GITHUB_ENV
```

---

### Problem 2.3: GitHub Secrets Configuration
**Symptom:**
Build fails silently when secrets aren't configured properly.

**Solution:**
Ensure these secrets exist in GitHub:
- `ANDROID_KEY_BASE64`: Base64-encoded keystore
- `ANDROID_KEY_PASSWORD`: Keystore password
- `ANDROID_KEY_ALIAS`: Keystore alias (usually "upload")
- `VITE_SUPABASE_URL`: Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Supabase anonymous key

**Verification:**
```bash
# Check secret base64 encoding is valid
echo "$ANDROID_KEY_BASE64_VALUE" | base64 -d | file -
# Should output: data (for binary file)
```

---

## 3. Build Configuration Issues

### Problem 3.1: Gradle Deprecation Warnings
**Symptom:**
Build completes but with warnings about deprecated Gradle features.

**Solution:**
Update `build.gradle.kts` to suppress or fix warnings (non-critical for now, but track for future Gradle 9.0 compatibility).

---

## 4. Release Process Issues

### Problem 4.1: Multiple Tag Recreations
**Symptom:**
Tag created, pushed, then needed to be deleted and recreated due to upstream changes.

**Solution:**
When code changes happen after tagging:
```bash
git tag -d v0.3.0                           # Delete local
git push origin --delete v0.3.0             # Delete remote
git tag -a v0.3.0 -m "Release message"     # Recreate
git push origin v0.3.0                      # Push
```

---

### Problem 4.2: Build Monitoring
**Symptom:**
No real-time feedback on CI build status.

**Solution:**
Use GitHub CLI to monitor:
```bash
gh run view <run_id>
gh run list --workflow=release.yml
```

Or watch directly: https://github.com/deepakraaaj/MissionControl/actions

---

## 5. Desktop App Issues

### Problem 5.1: HUD Window Not Showing
**Symptom:**
After login on Windows exe:
- Main application appears
- HUD window (separate window) doesn't appear
- App becomes unresponsive

**Root Cause:**
Likely one of:
1. HUD window creation fails silently in Tauri
2. App state/cache is corrupted
3. Database initialization fails
4. Permission/rendering issue on Windows

**Solution:**

#### Step 1: Clear App Cache
```
Windows:
- Delete: %APPDATA%\MissionControl
- Delete: %LOCALAPPDATA%\MissionControl
```

#### Step 2: Reinstall Fresh
- Uninstall app (Control Panel → Programs)
- Delete cache folders above
- Reinstall v0.3.0 exe

#### Step 3: Check Logs
If problem persists:
```
Check %LOCALAPPDATA%\MissionControl for logs
Press F12 in app for browser console (may show errors)
```

---

### Problem 5.2: App Won't Reopen After Closing
**Symptom:**
App closes, won't start again until cache is cleared.

**Root Cause:**
Likely database lock or corrupted state file.

**Solution:**
See Problem 5.1 solutions above, specifically clearing `%APPDATA%\MissionControl`.

---

## 6. Lessons Learned

### What Worked Well
✅ Local APK building with test keystore for verification
✅ CI/CD workflow structure (3 parallel builds)
✅ Using `rootProject.file()` for proper path resolution
✅ Stable action versions (v4, v5)

### What to Improve
❌ GitHub secrets validation before release builds
❌ Better error logging for HUD window creation
❌ Local/CI keystore management consistency
❌ Desktop app database initialization error handling

---

## 7. Quick Reference: Build Commands

### Local Android Build
```bash
npm run android:build:release
```

### Local Desktop Build
```bash
npm run tauri:build
```

### Trigger CI Release
```bash
git tag -a v0.x.x -m "Release message"
git push origin v0.x.x
```

### Check CI Status
```bash
gh run list --workflow=release.yml --limit=5
```

---

## 8. Future Prevention Checklist

Before releasing:
- [ ] Verify GitHub secrets are valid and up-to-date
- [ ] Test local Android build with keystore
- [ ] Confirm stable action versions in workflow
- [ ] Build desktop app locally to catch UI issues
- [ ] Test login and HUD window on Windows
- [ ] Check database initialization logs
- [ ] Verify all three platform artifacts before publishing

---

## 9. Contact & Support

For issues with:
- **Android builds**: Check keystore path and password
- **Desktop app**: Clear cache at `%APPDATA%/MissionControl`
- **CI/CD**: Check GitHub secrets and action versions
- **HUD window**: Monitor logs and browser console (F12)

