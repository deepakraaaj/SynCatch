# Android Release

MissionControl uses Tauri's Android signing flow with a private Java keystore.

## Local setup

Run:

```bash
./scripts/setup-android-signing.sh
```

This creates:

- a private keystore at `~/.config/missioncontrol/android-upload-keystore.jks`
- a local `src-tauri/gen/android/keystore.properties` file used by Gradle release builds

Both files stay out of git.

## GitHub release secrets

To sync the same signing key to GitHub Actions:

```bash
./scripts/setup-android-signing.sh --github
```

This sets:

- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`
- `ANDROID_KEY_BASE64`

## Local Android release build

```bash
./scripts/build-android-release.sh
```

Artifacts are generated under:

- `src-tauri/gen/android/app/build/outputs/apk/`
- `src-tauri/gen/android/app/build/outputs/bundle/`

## Java requirement

The generated Android project is stable with Java 21. The helper script prefers Java 21 automatically before invoking the Tauri Android build.
