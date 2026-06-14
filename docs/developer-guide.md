# SynCatch Developer Guide

Common development workflows and troubleshooting for building, running, and testing SynCatch on desktop and Android.

> **Note on identifiers:** SynCatch is the product name, but the underlying Tauri bundle identifier is still `com.missioncontrol.desktop` and the Linux package is `mission-control`. On-disk paths in this guide reflect that — they're correct as written.

## Quick Start — Run in Debug Mode

Once the [prerequisites](#0-environment-setup-prerequisites) are installed:

```bash
git clone https://github.com/deepakraaaj/SynCatch.git
cd SynCatch
npm install

# Desktop (Tauri shell + hot reload + devtools)
npm run tauri:dev

# Web frontend only (fastest UI iteration, no native shell) → http://localhost:1420
npm run dev

# Android (device or emulator attached — see §2)
npm run tauri android dev
```

- **Desktop debug**: `npm run tauri:dev` builds a debug Rust binary, opens the app, and hot-reloads the frontend on save. Right-click → **Inspect** (or F12) opens WebKit devtools.
- **Android debug**: `npm run tauri android dev` deploys a debug build to the connected device/emulator with live reload. View JS logs with `adb logcat | grep "Web Console"`.

Detailed setup and troubleshooting follow.

---

## 0. Environment Setup (Prerequisites)

### A. General Tools
* **Rust**: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
* **Node.js**: 18+ (20+ recommended), ideally via `nvm`.
* **Build tools**: `sudo apt install build-essential curl wget libssl-dev`

### B. Linux Desktop Libraries
```bash
sudo apt install libgtk-3-dev libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev \
    libsoup-3.0-dev libxdo-dev
```

### C. Android Development
* **Android Studio** → SDK Manager, install:
    * Android SDK Platform (API 34 or 35)
    * Android SDK Build-Tools
    * **NDK (Side by side)** — required for Rust compilation
    * **CMake**
* **Java**: `sudo apt install openjdk-21-jdk` (the generated Android project is stable on Java 21)
* **Environment variables** in `~/.bashrc` / `~/.zshrc`:
    ```bash
    export ANDROID_HOME=$HOME/Android/Sdk
    export NDK_HOME=$ANDROID_HOME/ndk/$(ls $ANDROID_HOME/ndk)
    ```

---

## 1. Managing Processes & Port Conflicts

If you see `Error: Port 1420 is already in use`, a previous dev session didn't shut down cleanly.

### Clean ports and processes
```bash
# Kill by port
lsof -ti :1420,1421 | xargs kill -9 2>/dev/null

# Kill by name
pkill -f "vite"
pkill -f "mission-control"
```

### Check what's still running
```bash
lsof -i :1420
ps aux | grep mission-control
```

---

## 2. Android Development Workflow

### Option A: Physical Device (USB)
One-time setup:
* **Enable Developer Options**: Settings → About Phone → tap "Build Number" 7 times.
* **Enable USB Debugging**: Settings → System/Developer Options → USB Debugging ON.
* **Trust the computer**: accept the "Allow USB Debugging?" prompt (check "Always allow").

Then connect via USB and run:
```bash
npm run tauri android dev
```

### Option B: Emulator
```bash
# List available AVDs
~/Android/Sdk/emulator/emulator -list-avds

# Start one (replace with your AVD name)
~/Android/Sdk/emulator/emulator -avd Pixel_7 &

# Run the app
npm run tauri android dev
```

---

## 3. Fresh Start (Deep Clean)

To test a build as if installing for the first time:

### Remove the installed app
> Older installs use the package name `mission-control`; builds from the SynCatch rebrand onward use `syncatch`. Use whichever matches what's installed (`dpkg -l | grep -iE 'syncatch|mission-control'`).

```bash
# Uninstall the package (use 'syncatch' for newer builds)
sudo apt remove --purge -y mission-control

# Remove the app-drawer shortcut if it lingers
sudo rm -f /usr/share/applications/MissionControl.desktop

# Delete local database + settings (CRITICAL for a true fresh test)
rm -rf ~/.local/share/com.missioncontrol.desktop
```

### Clean the build cache
For stubborn Rust errors after config changes:
```bash
cd src-tauri && cargo clean && cd ..
```

---

## 4. Important Notes

### Desktop dev vs. system install
If SynCatch is installed system-wide, **close it before** running `npm run tauri:dev`. Because of the single-instance guard, the dev build exits immediately if the installed one is already running.

### Mobile multi-window limitation
Android supports a **single window**. The desktop HUD and Quick Add windows are handled per-platform in `src-tauri/src/lib.rs`:
- **Desktop**: created dynamically at startup.
- **Android**: only the `main` window exists; Quick Add opens as a mobile overlay inside it.

---

## 5. Quick Reference

| Goal | Command |
| :--- | :--- |
| Run desktop dev | `npm run tauri:dev` |
| Run web frontend only | `npm run dev` |
| Run Android dev | `npm run tauri android dev` |
| Stop everything | `lsof -ti :1420,1421 \| xargs kill -9` |
| Android logs | `adb logcat \| grep "Web Console"` |

See also: [Android Release](android-release.md) · [Release Troubleshooting](release-troubleshooting.md) · [Supabase Setup](supabase-setup.md)
